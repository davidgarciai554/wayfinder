import { lstatSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { WayfinderError } from './errors.ts';

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ID_RE = /^[A-Z]{2,6}-[1-9]\d{0,8}$/;
export const ID_PREFIX_RE = /^[A-Z]{2,6}$/;
/** Error records use their own IDs; ERR is reserved so no project can produce the same ones. */
export const ERROR_ID_PREFIX = 'ERR';
export const ERROR_ID_RE = /^ERR-[1-9]\d{0,8}$/;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

export function getHome(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.WAYFINDER_HOME?.trim();
  if (!configured) return join(homedir(), '.wayfinder');
  // Plugin options may hold "~/.wayfinder"; expand it like a shell would.
  return resolve(configured.replace(/^~(?=$|[\\/])/, homedir()));
}

export function assertSlug(slug: string): void {
  if (!SLUG_RE.test(slug) || WINDOWS_RESERVED.test(slug)) {
    throw new WayfinderError('store.invalidSlug', { value: slug });
  }
}

export function assertId(id: string): void {
  if (!ID_RE.test(id)) throw new WayfinderError('store.invalidId', { value: id });
}

export function assertErrorId(id: string): void {
  if (!ERROR_ID_RE.test(id)) throw new WayfinderError('store.invalidErrorId', { value: id });
}

/** Turns a title into an ASCII file slug that always satisfies SLUG_RE. */
export function slugify(text: string): string {
  const ascii = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  const slug = ascii || 'task';
  return WINDOWS_RESERVED.test(slug) ? `${slug}-task` : slug;
}

function isInside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Builds a path under `home` and refuses anything that escapes it or that crosses a
 * symlink or junction below `home` (lstat reports junctions as symbolic links on Windows).
 */
export function safeJoin(home: string, ...parts: string[]): string {
  const base = resolve(home);
  const target = resolve(base, ...parts);
  if (!isInside(base, target)) throw new WayfinderError('store.pathOutsideHome', { value: parts.join('/') });
  const rel = relative(base, target);
  let current = base;
  for (const piece of rel === '' ? [] : rel.split(sep)) {
    current = join(current, piece);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      break; // The rest of the path does not exist yet, so it cannot be a link.
    }
    if (stat.isSymbolicLink()) throw new WayfinderError('store.symlinkRejected', { value: relative(base, current) });
  }
  return target;
}

/** True when `target` (resolved through existing links) lives inside `dir`. */
export function isWithin(dir: string, target: string): boolean {
  const real = (p: string) => {
    try {
      return realpathSync.native(p);
    } catch {
      return resolve(p);
    }
  };
  const a = real(dir);
  const b = real(target);
  return process.platform === 'win32' ? isInside(a.toLowerCase(), b.toLowerCase()) : isInside(a, b);
}

export function projectDir(home: string, slug: string): string {
  assertSlug(slug);
  return safeJoin(home, 'projects', slug);
}
