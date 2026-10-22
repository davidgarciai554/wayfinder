import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { WayfinderError, type Warning } from './errors.ts';
import { commitPaths, gitAvailable, initRepo, isGitRepo } from './git.ts';
import { findSecrets } from './secrets.ts';
import { writeFileAtomic } from './sync.ts';
import type { Lang } from '../i18n/index.ts';

const GITIGNORE = '.wayfinder.lock\n*.tmp\n.state/\n';

/** serve and mcp refuse to run on a folder that `init` has not prepared (e.g. an empty Docker volume). */
export function assertInitialized(home: string): void {
  if (!existsSync(join(home, '.git')) || !existsSync(join(home, 'projects'))) {
    throw new WayfinderError('serve.notInitialized', { path: home });
  }
}

export interface InitResult {
  created: boolean;
  home: string;
  warnings: Warning[];
  secrets: Array<{ file: string; pattern: string }>;
}

function isWayfinderHome(home: string): boolean {
  return existsSync(join(home, 'projects')) && existsSync(join(home, '.git'));
}

function scanExisting(home: string): Array<{ file: string; pattern: string }> {
  const found: Array<{ file: string; pattern: string }> = [];
  const projects = join(home, 'projects');
  if (!existsSync(projects)) return found;
  for (const entry of readdirSync(projects, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const full = join(entry.parentPath, entry.name);
    const patterns = findSecrets(readFileSync(full, 'utf8'));
    if (patterns.length) found.push({ file: relative(home, full).replaceAll('\\', '/'), pattern: patterns.join(', ') });
  }
  return found;
}

/**
 * Idempotent. An existing Wayfinder home is never modified: it is only scanned for secrets.
 * A non-empty folder that is not a Wayfinder home is refused instead of being taken over.
 */
export function initHome(home: string, options: { lang?: Lang } = {}): InitResult {
  if (existsSync(home)) {
    if (!statSync(home).isDirectory()) throw new WayfinderError('init.notADirectory', { path: home });
    if (isWayfinderHome(home)) return { created: false, home, warnings: [], secrets: scanExisting(home) };
    if (readdirSync(home).length > 0) throw new WayfinderError('init.notEmpty', { path: home });
  }
  if (!gitAvailable()) throw new WayfinderError('git.missingForInit', {});
  try {
    mkdirSync(join(home, 'projects'), { recursive: true });
  } catch (error) {
    throw new WayfinderError('init.notWritable', { path: home, detail: (error as Error).message });
  }
  writeFileAtomic(join(home, '.gitignore'), GITIGNORE);
  const files = ['.gitignore'];
  if (options.lang) {
    writeFileAtomic(join(home, 'config.json'), `${JSON.stringify({ language: options.lang }, null, 2)}\n`);
    files.push('config.json');
  }
  const init = initRepo(home);
  if (!init.ok || !isGitRepo(home)) {
    throw new WayfinderError(init.missing ? 'git.missingForInit' : 'git.initFailed', { detail: init.stderr.trim() });
  }
  const warnings = commitPaths(home, files, 'wf: init');
  return { created: true, home, warnings, secrets: [] };
}
