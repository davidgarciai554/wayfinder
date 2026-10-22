import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { WayfinderError } from './errors.ts';

const sleeper = new Int32Array(new SharedArrayBuffer(4));
export function sleepSync(ms: number): void {
  Atomics.wait(sleeper, 0, 0, ms);
}

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** Writes through a temporary file and a rename, retrying the transient locks Windows produces. */
export function writeFileAtomic(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, content);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!RETRYABLE.has(code) || attempt >= 20) {
        rmSync(tmp, { force: true });
        throw error;
      }
      sleepSync(25);
    }
  }
}

export const LOCK_TTL_MS = 10_000;
const LOCK_TIMEOUT_MS = 20_000;

/**
 * Cross-process lock based on an atomic mkdir. A lock older than LOCK_TTL_MS is treated as
 * orphaned. Only valid on local disks: network shares and sync folders may not honour mkdir atomicity.
 */
export function withLock<T>(home: string, fn: () => T): T {
  const lockDir = join(home, '.wayfinder.lock');
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      // Windows answers EPERM/EBUSY/EACCES to mkdir while another process is deleting the lock:
      // that is contention too, so wait for it like EEXIST.
      if (code !== 'EEXIST' && !RETRYABLE.has(code)) throw error;
      if (code !== 'EEXIST') {
        if (Date.now() - started > LOCK_TIMEOUT_MS) throw new WayfinderError('store.lockTimeout', { path: lockDir });
        sleepSync(10 + Math.floor(Math.random() * 30));
        continue;
      }
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > LOCK_TTL_MS) {
          rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue; // Released between mkdir and stat.
      }
      if (Date.now() - started > LOCK_TIMEOUT_MS) throw new WayfinderError('store.lockTimeout', { path: lockDir });
      sleepSync(10 + Math.floor(Math.random() * 30));
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}
