import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSecrets } from './secrets.ts';
import type { Warning } from './errors.ts';
import { sleepSync } from './sync.ts';

/**
 * The only git subcommands Wayfinder may run. There is deliberately no push, fetch, pull,
 * remote or config: the data repository never talks to the network.
 */
export const ALLOWED_SUBCOMMANDS: ReadonlySet<string> = new Set(['init', 'add', 'commit', 'status', 'rev-parse', 'log']);
export const IDENTITY = { name: 'Wayfinder', email: 'wayfinder@localhost' } as const;

export interface GitResult {
  ok: boolean;
  missing: boolean;
  stdout: string;
  stderr: string;
}

export type GitRunner = (args: string[]) => GitResult;

/**
 * WAY-35: variables that point git at another repository, work tree, index or object store
 * (`git rev-parse --local-env-vars`). Inherited from a git hook or a shell that exports them,
 * they win over `-C`, so they are dropped. Windows env names are case-insensitive.
 */
const REPO_ENV = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_OBJECT_DIRECTORY',
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_GRAFT_FILE', 'GIT_INDEX_FILE', 'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE', 'GIT_PREFIX', 'GIT_SHALLOW_FILE', 'GIT_COMMON_DIR',
]);

const realRunner: GitRunner = (args) => {
  try {
    const stdout = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // Node's default is 1 MiB, and the log of a whole listing (modifiedOutsideAmong) passes it
      // at around 12,000 commits. 64 MiB covers some 500,000.
      maxBuffer: 64 * 1024 * 1024,
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !REPO_ENV.has(name.toUpperCase()))), GIT_TERMINAL_PROMPT: '0' },
    });
    return { ok: true, missing: false, stdout, stderr: '' };
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return { ok: false, missing: e.code === 'ENOENT', stdout: e.stdout ?? '', stderr: e.stderr ?? e.message };
  }
};

let runner: GitRunner = realRunner;

/** Test hook: replaces the process runner. Returns a function that restores the previous one. */
export function setGitRunner(next: GitRunner): () => void {
  const previous = runner;
  runner = next;
  return () => {
    runner = previous;
  };
}

export function git(home: string, subcommand: string, args: string[] = []): GitResult {
  if (!ALLOWED_SUBCOMMANDS.has(subcommand)) throw new Error(`git subcommand not allowed: ${subcommand}`);
  return runner([
    '-C', home,
    '-c', `user.name=${IDENTITY.name}`,
    '-c', `user.email=${IDENTITY.email}`,
    '-c', 'core.autocrlf=false',
    '-c', 'commit.gpgsign=false',
    '-c', `safe.directory=${home.replaceAll('\\', '/')}`,
    subcommand,
    ...args,
  ]);
}

/** `git --version` runs no subcommand, so it stays outside the allow-list. */
export function gitAvailable(): boolean {
  return runner(['--version']).ok;
}

export function isGitRepo(home: string): boolean {
  return git(home, 'rev-parse', ['--git-dir']).ok;
}

export function initRepo(home: string): GitResult {
  return git(home, 'init', ['-q']);
}

const TEXT_FILE = /\.(md|json|txt)$/i;

/**
 * Commits exactly `paths` (relative to `home`) and nothing else. A failure never undoes the
 * write that preceded it: it is reported as a warning. index.lock is never removed.
 */
export function commitPaths(home: string, paths: string[], message: string, trailers: string[] = []): Warning[] {
  for (const rel of paths) {
    if (!TEXT_FILE.test(rel)) continue;
    let content: string;
    try {
      content = readFileSync(join(home, rel), 'utf8');
    } catch {
      continue;
    }
    const found = findSecrets(content);
    if (found.length > 0) return [{ key: 'git.secretNotCommitted', vars: { file: rel, pattern: found.join(', ') } }];
  }

  const commitArgs = ['--no-verify', '-q', '-m', message, ...(trailers.length ? ['-m', trailers.join('\n')] : []), '--', ...paths];
  for (let attempt = 0; attempt < 2; attempt++) {
    let result = git(home, 'add', ['--', ...paths]);
    if (result.ok) result = git(home, 'commit', commitArgs);
    if (result.ok) return [];
    if (result.missing) return [{ key: 'git.missing', vars: {} }];
    if (/index\.lock/.test(result.stderr) && attempt === 0) {
      sleepSync(200);
      continue;
    }
    if (/index\.lock/.test(result.stderr)) return [{ key: 'git.indexLocked', vars: {} }];
    return [{ key: 'git.commitFailed', vars: { detail: result.stderr.trim().split('\n')[0] ?? '' } }];
  }
  return [{ key: 'git.indexLocked', vars: {} }];
}

/** "Modified outside Wayfinder": uncommitted changes, or a last commit by another identity. */
export function modifiedOutside(home: string, rel: string): boolean {
  const status = git(home, 'status', ['--porcelain', '--', rel]);
  if (!status.ok) return false;
  if (status.stdout.trim() !== '') return true;
  const log = git(home, 'log', ['-1', '--format=%an%x09%ae', '--', rel]);
  if (!log.ok || log.stdout.trim() === '') return false;
  return log.stdout.trim() !== `${IDENTITY.name}\t${IDENTITY.email}`;
}

/**
 * WAY-23: modifiedOutside for the files of one folder with two git processes in all, instead of
 * two per file. `dir` and `files` are relative to `home`; only `files` can be in the result.
 *
 * On the linear history Wayfinder writes, the answer is the per-file one. After a merge made by
 * hand, the first-parent line decides (the merge is a change by whoever made it), which can flag
 * more files than the per-file check, never fewer. If the batch cannot run, it asks file by file.
 *
 * Known limit: the log walks the whole history of `dir` on every call (about 0.3 s with 5,000
 * commits and 1 s with 20,000). If a real listing goes over a second, list only the commits of
 * other identities (`log -P --author` with a negation) or keep the result per HEAD.
 */
export function modifiedOutsideAmong(home: string, dir: string, files: readonly string[]): Set<string> {
  const wanted = new Set(files);
  const out = new Set<string>();
  if (wanted.size === 0) return out;
  // -z: paths are not quoted. --no-renames: one path per record. --untracked-files=all: a folder
  // git has never seen is listed file by file, not as `?? folder/`.
  const status = git(home, 'status', ['--porcelain', '-z', '--no-renames', '--untracked-files=all', '--', dir]);
  if (!status.ok) {
    // Without git nothing is flagged, as in modifiedOutside; any other failure asks file by file.
    if (!status.missing) for (const file of files) if (modifiedOutside(home, file)) out.add(file);
    return out;
  }
  // Each record is `XY path`.
  for (const record of status.stdout.split('\0')) {
    const file = record.slice(3);
    if (wanted.has(file)) out.add(file);
  }
  const log = git(home, 'log', ['--first-parent', '-m', '--format=%x01%an%x09%ae', '--name-only', '-z', '--', dir]);
  if (!log.ok) {
    // A failed log may carry partial output (maxBuffer): it is never read.
    for (const file of files) if (!out.has(file) && modifiedOutside(home, file)) out.add(file);
    return out;
  }
  // Newest commit first. Split by NUL: a piece that starts with 0x01 is the author of a commit and
  // the pieces after it are its paths (no path under `dir` can start with 0x01). The first commit
  // that names a file is the last one that changed it.
  const own = `${IDENTITY.name}\t${IDENTITY.email}`;
  const seen = new Set<string>();
  let foreign = false;
  for (const piece of log.stdout.split('\0')) {
    if (piece.startsWith('\x01')) {
      foreign = piece.slice(1).replace(/\n+$/, '') !== own;
      continue;
    }
    const file = piece.replace(/^\n+/, '');
    if (!wanted.has(file) || seen.has(file)) continue;
    seen.add(file);
    if (foreign) out.add(file);
  }
  return out;
}
