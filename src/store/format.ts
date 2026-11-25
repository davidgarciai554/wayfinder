import { closeSync, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { WayfinderError, type Warning } from './errors.ts';

/**
 * WAY-24: version of the data folder format. Raise it only with a change that older versions
 * cannot read or write safely; additive changes stay within it (see the 1.x rule in the README).
 */
export const FORMAT_VERSION = 1;

/** One decimal integer at the root of the data folder, versioned with the data. */
export const FORMAT_FILE = 'FORMAT';

const FORMAT_RE = /^\d{1,6}$/;
/** "1\n" or "1\r\n" (git autocrlf) fit easily; anything longer is not a mark. */
const MAX_FORMAT_BYTES = 32;

export type FormatState =
  | { state: 'ok' }
  | { state: 'newer'; found: number; supported: number }
  | { state: 'unreadable'; supported: number };

/**
 * Read on every call, never cached: a long-lived MCP or web process must see a mark written by a
 * newer version after it started (ERR-9). No mark is format 1, so folders written before WAY-24
 * open as they are. Anything that is not one decimal integer above 0 (empty, text, a directory, a
 * symlink, a huge file) is `unreadable`: it is warned about and never blocks. Only the validated
 * integer leaves this function, never the file's content.
 */
export function checkFormat(home: string): FormatState {
  const unreadable: FormatState = { state: 'unreadable', supported: FORMAT_VERSION };
  const path = join(home, FORMAT_FILE);
  let text: string;
  try {
    if (!lstatSync(path).isFile()) return unreadable;
    const fd = openSync(path, 'r');
    try {
      const { size } = fstatSync(fd);
      if (size > MAX_FORMAT_BYTES) return unreadable;
      const buffer = Buffer.alloc(size);
      readSync(fd, buffer, 0, size, 0);
      text = buffer.toString('utf8').trim();
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR' ? { state: 'ok' } : unreadable;
  }
  if (!FORMAT_RE.test(text)) return unreadable;
  const found = Number(text);
  if (found === 0) return unreadable;
  return found > FORMAT_VERSION ? { state: 'newer', found, supported: FORMAT_VERSION } : { state: 'ok' };
}

/** The warning every edge shows while the folder is not plainly readable; null when it is. */
export function formatWarning(home: string, format: FormatState = checkFormat(home)): Warning | null {
  if (format.state === 'newer') return { key: 'store.dataNewer', vars: { found: format.found, supported: format.supported } };
  if (format.state === 'unreadable') return { key: 'store.formatUnreadable', vars: { supported: format.supported } };
  return null;
}

/** Option B of the plan: data from a newer format is read only. Every write goes through withLock, which calls this. */
export function assertFormatWritable(home: string): void {
  const format = checkFormat(home);
  if (format.state === 'newer') throw new WayfinderError('store.dataNewer', { found: format.found, supported: format.supported });
}
