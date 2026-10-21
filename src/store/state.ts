import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './sync.ts';

/** `.state/` holds ephemeral, unversioned JSON (chat orders, reviews). Corrupt files read as empty. */
export function readState<T extends object>(home: string, name: string): T {
  const file = join(home, '.state', name);
  if (!existsSync(file)) return {} as T;
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export function writeState(home: string, name: string, value: object): void {
  writeFileAtomic(join(home, '.state', name), `${JSON.stringify(value, null, 2)}\n`);
}
