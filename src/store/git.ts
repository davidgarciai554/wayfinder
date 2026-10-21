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

const realRunner: GitRunner = (args) => {
  try {
    const stdout = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
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
