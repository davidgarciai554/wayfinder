import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ALLOWED_SUBCOMMANDS, commitPaths, git, modifiedOutside, setGitRunner, type GitResult } from '../src/store/git.ts';
import { createTask, updateTask } from '../src/store/tasks.ts';
import { appendLog } from '../src/store/log.ts';
import { commitCount, gitOut, makeHome, makeProject } from './helpers.ts';

test('each write is exactly one commit that contains only its own paths', (t) => {
  const home = makeHome(t);
  makeProject(home);
  // Foreign state: an untracked file, a modified tracked file and something staged by the person.
  writeFileSync(join(home, 'notes.txt'), 'mine');
  writeFileSync(join(home, '.gitignore'), `${readFileSync(join(home, '.gitignore'), 'utf8')}# edited by hand\n`);
  writeFileSync(join(home, 'staged.txt'), 'staged');
  execFileSync('git', ['-C', home, 'add', 'staged.txt']);
  const before = commitCount(home);

  const { task } = createTask(home, 'demo', { title: 'Uno' }, 'mcp');
  assert.equal(commitCount(home), before + 1);
  assert.equal(gitOut(home, 'show', '--name-only', '--format=', 'HEAD'), task.file);
  assert.equal(gitOut(home, 'log', '-1', '--format=%s'), `wf: create ${task.id}`);
  assert.equal(gitOut(home, 'log', '-1', '--format=%an <%ae>'), 'Wayfinder <wayfinder@localhost>');

  const { file } = appendLog(home, 'demo', 'Hecho');
  assert.equal(commitCount(home), before + 2);
  assert.equal(gitOut(home, 'show', '--name-only', '--format=', 'HEAD'), file);

  const status = gitOut(home, 'status', '--porcelain');
  assert.match(status, /^\?\? notes\.txt$/m);
  assert.match(status, /^ ?M \.gitignore$/m); // gitOut trims the first line's leading space.
  assert.match(status, /^A  staged\.txt$/m);
});

test('the code never pushes, fetches or touches remotes or global config', (t) => {
  const home = makeHome(t);
  makeProject(home);
  // A trap remote: if anything pushed, the bare repository would receive refs.
  const bare = join(home, '..', 'trap.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  execFileSync('git', ['-C', home, 'remote', 'add', 'origin', bare]);

  const calls: string[][] = [];
  const restore = setGitRunner((args) => {
    calls.push(args);
    try {
      return { ok: true, missing: false, stdout: execFileSync('git', args, { encoding: 'utf8' }), stderr: '' };
    } catch (e) {
      return { ok: false, missing: false, stdout: '', stderr: String((e as Error).message) };
    }
  });
  try {
    const { task } = createTask(home, 'demo', { title: 'Trampa' }, 'mcp');
    updateTask(home, 'demo', task.id, { body: 'x' });
    appendLog(home, 'demo', 'log');
  } finally {
    restore();
  }
  assert.ok(calls.length > 0);
  for (const args of calls) {
    const sub = args.find((a, i) => i > 0 && !a.startsWith('-') && args[i - 1] !== '-C' && args[i - 1] !== '-c');
    assert.ok(sub && ALLOWED_SUBCOMMANDS.has(sub), `unexpected git call: ${args.join(' ')}`);
    for (const forbidden of ['push', 'fetch', 'pull', 'remote', 'clone', '--global']) assert.ok(!args.includes(forbidden), args.join(' '));
  }
  assert.equal(gitOut(bare, 'for-each-ref'), '');
  assert.equal(gitOut(home, 'remote', '-v').split('\n').length, 2); // Unchanged: only the trap we added.
  assert.throws(() => git(home, 'push'), /not allowed/);
  assert.throws(() => git(home, 'remote'), /not allowed/);
});

test('global and local git config are never modified', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const globalFile = join(homedir(), '.gitconfig');
  const globalBefore = existsSync(globalFile) ? readFileSync(globalFile, 'utf8') : null;
  const localBefore = readFileSync(join(home, '.git', 'config'), 'utf8');
  createTask(home, 'demo', { title: 'Config' }, 'mcp');
  assert.equal(existsSync(globalFile) ? readFileSync(globalFile, 'utf8') : null, globalBefore);
  assert.equal(readFileSync(join(home, '.git', 'config'), 'utf8'), localBefore);
});

test('hostile titles are data, never arguments or shell', (t) => {
  const home = makeHome(t);
  makeProject(home);
  for (const title of ['"; rm -rf / #', '--amend', '-m injected', 'línea\ncon salto', '$(whoami) `id`']) {
    const { task, warnings } = createTask(home, 'demo', { title }, 'mcp');
    assert.deepEqual(warnings, []);
    assert.equal(gitOut(home, 'log', '-1', '--format=%s'), `wf: create ${task.id}`);
  }
  assert.equal(commitCount(home), 2 + 5);
});

test('git failures keep the write and only warn; index.lock is never removed', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const missing: GitResult = { ok: false, missing: true, stdout: '', stderr: '' };
  let restore = setGitRunner(() => missing);
  try {
    const { task, warnings } = createTask(home, 'demo', { title: 'Sin git' }, 'mcp');
    assert.deepEqual(warnings.map((w) => w.key), ['git.missing']);
    assert.ok(existsSync(join(home, task.file)));
  } finally {
    restore();
  }

  const lock = join(home, '.git', 'index.lock');
  writeFileSync(lock, '');
  const { task, warnings } = createTask(home, 'demo', { title: 'Con lock' }, 'mcp');
  assert.deepEqual(warnings.map((w) => w.key), ['git.indexLocked']);
  assert.ok(existsSync(lock), 'index.lock must not be deleted');
  assert.ok(existsSync(join(home, task.file)));
});

test('a secret added by hand to a file is never committed', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const { task } = createTask(home, 'demo', { title: 'Manual' }, 'mcp');
  const file = join(home, task.file);
  writeFileSync(file, `${readFileSync(file, 'utf8')}\nAKIA${'A'.repeat(16)}\n`);
  const before = commitCount(home);
  const { warnings } = updateTask(home, 'demo', task.id, { priority: 'high' });
  assert.deepEqual(warnings.map((w) => w.key), ['git.secretNotCommitted']);
  assert.equal(commitCount(home), before);
});

test('a planted pre-commit hook cannot block or run during Wayfinder commits', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const marker = join(home, '..', 'hook-ran');
  mkdirSync(join(home, '.git', 'hooks'), { recursive: true });
  writeFileSync(join(home, '.git', 'hooks', 'pre-commit'), `#!/bin/sh\necho ran > "${marker.replaceAll('\\', '/')}"\nexit 1\n`, { mode: 0o755 });
  const before = commitCount(home);
  const { warnings } = createTask(home, 'demo', { title: 'Hook' }, 'mcp');
  assert.deepEqual(warnings, []);
  assert.equal(commitCount(home), before + 1);
  assert.equal(existsSync(marker), false);
});

test('modifiedOutside flags uncommitted edits and commits by another identity', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const { task } = createTask(home, 'demo', { title: 'Fuera' }, 'mcp');
  assert.equal(modifiedOutside(home, task.file), false);
  const file = join(home, task.file);
  writeFileSync(file, `${readFileSync(file, 'utf8')}editado\n`);
  assert.equal(modifiedOutside(home, task.file), true);
  execFileSync('git', ['-C', home, '-c', 'user.name=Someone', '-c', 'user.email=s@example.com', 'commit', '-qam', 'manual']);
  assert.equal(modifiedOutside(home, task.file), true);
  updateTask(home, 'demo', task.id, { priority: 'low' });
  assert.equal(modifiedOutside(home, task.file), false);
  assert.ok(commitPaths); // exported for the MCP and web layers
});
