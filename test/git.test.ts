import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ALLOWED_SUBCOMMANDS, commitPaths, git, IDENTITY, modifiedOutside, modifiedOutsideAmong, setGitRunner, type GitResult } from '../src/store/git.ts';
import { createTask, listTasks, updateTask } from '../src/store/tasks.ts';
import { createProject } from '../src/store/project.ts';
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

// ---------- WAY-23: the flag for a whole listing, with two git processes ----------

const TASKS = 'projects/demo/tasks';

/** Plain git on the temporary home, with Wayfinder's own line-ending setting. */
const rawGit = (home: string, ...args: string[]) =>
  execFileSync('git', ['-C', home, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** The same, as the person committing by hand with their own identity. */
const asSomeone = (home: string, ...args: string[]) => rawGit(home, '-c', 'user.name=Someone', '-c', 'user.email=someone@localhost', ...args);
const editByHand = (home: string, file: string) => writeFileSync(join(home, file), `${readFileSync(join(home, file), 'utf8')}editado a mano\n`);
/** A runner that runs real git and records every call. */
const countingRunner = (calls: string[][]) => (args: string[]): GitResult => {
  calls.push(args);
  try {
    return { ok: true, missing: false, stdout: execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), stderr: '' };
  } catch (e) {
    return { ok: false, missing: false, stdout: '', stderr: String((e as Error).message) };
  }
};

/** Every task file of the project gets the same answer from the batch and from the per-file check. */
function flaggedBothWays(home: string, label: string): string[] {
  const { tasks, unreadable } = listTasks(home, 'demo');
  const files = [...tasks.map((x) => x.file), ...unreadable.map((u) => u.file)];
  const perFile = files.filter((f) => modifiedOutside(home, f)).sort();
  assert.deepEqual([...modifiedOutsideAmong(home, TASKS, files)].sort(), perFile, label);
  return perFile;
}

test('WAY-23: the batch flags the same files as the per-file check after hand edits, foreign commits, renames and untracked files', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const make = (title: string) => createTask(home, 'demo', { title, body: 'Cuerpo.\n' }, 'web').task;
  const clean = make('Limpia');
  const edited = make('Editada sin commit');
  const foreign = make('Commit ajeno');
  const rewritten = make('Commit ajeno y luego Wayfinder');
  const staged = make('En el indice');
  assert.deepEqual(flaggedBothWays(home, 'clean'), []);

  editByHand(home, edited.file);
  assert.deepEqual(flaggedBothWays(home, 'uncommitted edit'), [edited.file]);

  editByHand(home, foreign.file);
  asSomeone(home, 'commit', '-q', '-m', 'manual', '--', foreign.file);
  editByHand(home, rewritten.file);
  asSomeone(home, 'commit', '-q', '-m', 'manual', '--', rewritten.file);
  updateTask(home, 'demo', rewritten.id, { priority: 'low' });
  assert.deepEqual(flaggedBothWays(home, 'foreign commits'), [edited.file, foreign.file].sort());

  editByHand(home, staged.file);
  rawGit(home, 'add', '--', staged.file);
  assert.ok(flaggedBothWays(home, 'staged change').includes(staged.file));

  // A task file made by hand: untracked, with spaces and non-ASCII letters (git would quote it).
  const handMade = `${TASKS}/WF-90-añadida a mano.md`;
  writeFileSync(join(home, handMade), readFileSync(join(home, clean.file), 'utf8').replace(`id: ${clean.id}`, 'id: WF-90'));
  assert.ok(flaggedBothWays(home, 'untracked file').includes(handMade));
  asSomeone(home, 'add', '--', handMade);
  asSomeone(home, 'commit', '-q', '-m', 'manual', '--', handMade);
  assert.ok(flaggedBothWays(home, 'hand-made file committed by another identity').includes(handMade));

  // One foreign commit with two tasks; Wayfinder rewrites one of them afterwards.
  const one = make('Lote uno');
  const two = make('Lote dos');
  editByHand(home, one.file);
  editByHand(home, two.file);
  asSomeone(home, 'commit', '-q', '-m', 'manual', '--', one.file, two.file);
  updateTask(home, 'demo', two.id, { priority: 'high' });
  const afterBatch = flaggedBothWays(home, 'foreign commit of two tasks');
  assert.ok(afterBatch.includes(one.file));
  assert.ok(!afterBatch.includes(two.file));

  // Renamed with git mv: first only in the index, then committed by hand.
  const renamed = make('Renombrada');
  const moved = `${TASKS}/${renamed.id}-otro-nombre.md`;
  rawGit(home, 'mv', renamed.file, moved);
  assert.ok(flaggedBothWays(home, 'git mv, not committed').includes(moved));
  asSomeone(home, 'commit', '-q', '-m', 'manual');
  assert.ok(flaggedBothWays(home, 'git mv, committed').includes(moved));
  assert.ok(!flaggedBothWays(home, 'the clean task stays clean').includes(clean.file));

  // A whole tasks folder git has never seen: plain status would only say `?? folder/`.
  createProject(home, { slug: 'otro', name: 'Otro', idPrefix: 'OT', localPath: 'D:/otro' });
  const lonely = 'projects/otro/tasks/OT-1-a-mano.md';
  mkdirSync(join(home, 'projects/otro/tasks'), { recursive: true });
  writeFileSync(join(home, lonely), readFileSync(join(home, clean.file), 'utf8').replace(`id: ${clean.id}`, 'id: OT-1'));
  assert.equal(modifiedOutside(home, lonely), true);
  assert.deepEqual([...modifiedOutsideAmong(home, 'projects/otro/tasks', [lonely])], [lonely]);
});

test('WAY-23: a hand-made merge counts as a change by whoever made it', (t) => {
  // The merge keeps the whole file of the branch edited by hand, and Wayfinder's write is newer.
  const home = makeHome(t);
  makeProject(home);
  const kept = createTask(home, 'demo', { title: 'Entera', body: 'Base.\n' }, 'web').task;
  const other = createTask(home, 'demo', { title: 'Otra' }, 'web').task;
  const trunk = rawGit(home, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
  rawGit(home, 'checkout', '-q', '-b', 'lado');
  editByHand(home, kept.file);
  asSomeone(home, 'commit', '-q', '-am', 'a mano en la rama');
  rawGit(home, 'checkout', '-q', trunk);
  updateTask(home, 'demo', kept.id, { priority: 'high' });
  updateTask(home, 'demo', other.id, { priority: 'low' });
  try {
    asSomeone(home, 'merge', '-q', '--no-commit', '--no-ff', 'lado');
  } catch {
    // A conflict is fine: the file of the branch is taken whole just below.
  }
  rawGit(home, 'checkout', 'lado', '--', kept.file);
  asSomeone(home, 'commit', '-q', '-m', 'merge a mano');
  assert.deepEqual(flaggedBothWays(home, 'merge that keeps the hand-edited file'), [kept.file]);

  // The other way round: the person merges the main line into their own branch and stays there.
  // The first-parent line then shows Wayfinder's write as part of the merge: flagged in excess.
  const reversed = makeHome(t);
  makeProject(reversed);
  const mine = createTask(reversed, 'demo', { title: 'En la rama', body: 'Base.\n' }, 'web').task;
  const theirs = createTask(reversed, 'demo', { title: 'En la principal' }, 'web').task;
  const main = rawGit(reversed, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
  updateTask(reversed, 'demo', theirs.id, { priority: 'high' });
  rawGit(reversed, 'checkout', '-q', '-b', 'lado', 'HEAD~1');
  editByHand(reversed, mine.file);
  asSomeone(reversed, 'commit', '-q', '-am', 'a mano en la rama');
  asSomeone(reversed, 'merge', '-q', '--no-ff', main, '-m', 'merge a mano');
  assert.equal(modifiedOutside(reversed, mine.file), true);
  assert.equal(modifiedOutside(reversed, theirs.file), false);
  assert.deepEqual([...modifiedOutsideAmong(reversed, TASKS, [mine.file, theirs.file])].sort(), [mine.file, theirs.file].sort());
});

test('WAY-23: author names and emails that imitate the separators are still another identity', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const own = `${IDENTITY.name}\t${IDENTITY.email}`;
  const authors: Array<[string, string, boolean]> = [
    ['Way\x01finder', IDENTITY.email, true],
    [own, 'nobody@localhost', true],
    [IDENTITY.name, `${IDENTITY.email}\x01${own}`, true],
    [IDENTITY.name.toLowerCase(), IDENTITY.email, true],
    // git trims the name: this is Wayfinder's identity, which neither check can tell apart.
    [`${IDENTITY.name} `, IDENTITY.email, false],
  ];
  authors.forEach(([name, email, flagged], i) => {
    const { task } = createTask(home, 'demo', { title: `Autor ${i + 1}` }, 'web');
    editByHand(home, task.file);
    rawGit(home, '-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', 'manual', '--', task.file);
    const label = JSON.stringify([name, email]);
    assert.equal(modifiedOutside(home, task.file), flagged, label);
    assert.equal(modifiedOutsideAmong(home, TASKS, [task.file]).has(task.file), flagged, label);
  });
  flaggedBothWays(home, 'all of them together');
});

test('WAY-23: the batch runs two git processes whatever the number of files, and none without files', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const files: string[] = [];
  const add = (n: number) => {
    for (let i = 0; i < n; i++) files.push(createTask(home, 'demo', { title: `Tarea ${files.length + 1}` }, 'web').task.file);
  };
  const calls: string[][] = [];
  const restore = setGitRunner(countingRunner(calls));
  t.after(restore);
  for (const n of [5, 15]) {
    add(n);
    calls.length = 0;
    assert.equal(modifiedOutsideAmong(home, TASKS, files).size, 0);
    assert.equal(calls.length, 2, `${files.length} files`);
  }
  calls.length = 0;
  assert.equal(modifiedOutsideAmong(home, TASKS, []).size, 0);
  assert.equal(calls.length, 0);
});

test('WAY-23: when the batch cannot run, the answer is the per-file one and failed output is never read', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const clean = createTask(home, 'demo', { title: 'Limpia' }, 'web').task;
  const edited = createTask(home, 'demo', { title: 'Editada' }, 'web').task;
  const foreign = createTask(home, 'demo', { title: 'Ajena' }, 'web').task;
  editByHand(home, foreign.file);
  asSomeone(home, 'commit', '-q', '-m', 'manual', '--', foreign.file);
  editByHand(home, edited.file);
  const files = [clean.file, edited.file, foreign.file];
  const expected = [edited.file, foreign.file].sort();
  const real = countingRunner([]);
  const failing = (broken: (args: string[]) => GitResult | null) => {
    const restore = setGitRunner((args) => broken(args) ?? real(args));
    try {
      return [...modifiedOutsideAmong(home, TASKS, files)].sort();
    } finally {
      restore();
    }
  };
  const isBatchStatus = (args: string[]) => args.includes('status') && args.includes('--untracked-files=all');
  const isBatchLog = (args: string[]) => args.includes('log') && args.includes('--first-parent');
  const failed: GitResult = { ok: false, missing: false, stdout: '', stderr: 'boom' };

  assert.deepEqual(failing((args) => (isBatchStatus(args) ? failed : null)), expected, 'batch status fails');
  assert.deepEqual(failing((args) => (isBatchLog(args) ? failed : null)), expected, 'batch log fails');
  // A log cut short (maxBuffer) leaves partial output that names the clean task under a foreign author.
  const partial: GitResult = { ok: false, missing: false, stdout: `\x01Someone\tsomeone@localhost\0\n${clean.file}\0`, stderr: 'ENOBUFS' };
  assert.deepEqual(failing((args) => (isBatchLog(args) ? partial : null)), expected, 'partial log output');
  // No git at all: nothing is flagged, as with the per-file check, and it is asked once.
  const calls: string[][] = [];
  const restore = setGitRunner((args) => {
    calls.push(args);
    return { ok: false, missing: true, stdout: '', stderr: 'spawn git ENOENT' };
  });
  t.after(restore);
  assert.deepEqual([...modifiedOutsideAmong(home, TASKS, files)], []);
  assert.equal(calls.length, 1);
});
