import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { initHome } from '../src/store/init.ts';
import { createProject } from '../src/store/project.ts';

/** Fresh WAYFINDER_HOME in the OS temp folder: tests never touch the real ~/.wayfinder. */
export function makeHome(t: { after: (fn: () => void) => void }): string {
  const base = mkdtempSync(join(tmpdir(), 'wf-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const home = join(base, 'home');
  initHome(home);
  return home;
}

export function makeProject(home: string, slug = 'demo', idPrefix = 'WF'): void {
  createProject(home, { slug, name: 'Demo', idPrefix, localPath: 'D:/demo' });
}

export function fixedClock(iso = '2026-10-21T13:05:00'): () => Date {
  let ms = new Date(iso).getTime();
  return () => new Date((ms += 1000));
}

export const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Map of every file under `dir` (except .git) to its hash. */
export function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const full = join(e.parentPath, e.name);
    const rel = relative(dir, full).replaceAll('\\', '/');
    if (rel === '.git' || rel.startsWith('.git/')) continue;
    if (statSync(full).isFile()) out[rel] = sha(full);
  }
  return out;
}

export function gitOut(home: string, ...args: string[]): string {
  return execFileSync('git', ['-C', home, ...args], { encoding: 'utf8' }).trim();
}

export function commitCount(home: string): number {
  return Number(gitOut(home, 'rev-list', '--count', 'HEAD'));
}
