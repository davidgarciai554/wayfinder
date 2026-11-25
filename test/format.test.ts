import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approveByChat } from '../src/store/approve.ts';
import { attachCapture } from '../src/store/attach.ts';
import { createError, discardError, listErrors, noteError, readError, resolveError, updateError } from '../src/store/error-records.ts';
import { WayfinderError } from '../src/store/errors.ts';
import { checkFormat, FORMAT_FILE, FORMAT_VERSION, formatWarning } from '../src/store/format.ts';
import { initHome } from '../src/store/init.ts';
import { appendLog } from '../src/store/log.ts';
import { recordOrders, recordRegisterOrder, recordWebOrder } from '../src/store/mentions.ts';
import { createProject } from '../src/store/project.ts';
import { declineRegistration, registerByOrder } from '../src/store/register.ts';
import { reviewTask } from '../src/store/review.ts';
import { writeState } from '../src/store/state.ts';
import { withLock } from '../src/store/sync.ts';
import { createTask, dependencyStates, isBlocking, listTasks, logProgress, readTask, reopenTarget, setStatus, updateTask } from '../src/store/tasks.ts';
import { ORIGINS, PRIORITIES } from '../src/store/transitions.ts';
import { commitCount, gitOut, LEGACY_FILES, makeHome, makeLegacyHome, makeProject, sha, tree } from './helpers.ts';

const isKey = (key: string) => (e: unknown) => e instanceof WayfinderError && e.key === key;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

/** A change made by hand or by another version, committed like Wayfinder would. */
function commitAll(home: string, message: string): void {
  execFileSync('git', ['-C', home, '-c', 'user.name=Test', '-c', 'user.email=test@localhost', '-c', 'commit.gpgsign=false', 'add', '-A'], { stdio: 'pipe' });
  execFileSync('git', ['-C', home, '-c', 'user.name=Test', '-c', 'user.email=test@localhost', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message], { stdio: 'pipe' });
}

const snapshot = (home: string) => ({ tree: tree(home), commits: commitCount(home), status: gitOut(home, 'status', '--porcelain') });

test('the 1.x rule: the format and the values a rewrite would normalise are pinned', () => {
  // Raising FORMAT_VERSION, or adding a priority or an origin (older versions read an unknown one as
  // medium / user and lose it when they rewrite the task), needs a format bump: see the README.
  assert.equal(FORMAT_VERSION, 1, 'FORMAT_VERSION changed: read the 1.x rule in the README first');
  assert.deepEqual([...PRIORITIES], ['low', 'medium', 'high'], 'a new priority needs a format bump (README, 1.x rule)');
  assert.deepEqual([...ORIGINS], ['user', 'claude', 'routine'], 'a new origin needs a format bump (README, 1.x rule)');
});

test('checkFormat: no mark is format 1, a bigger integer is newer, anything else is unreadable', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'wf-format-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const home = join(base, 'home');
  mkdirSync(home);
  const mark = join(home, FORMAT_FILE);
  assert.deepEqual(checkFormat(join(base, 'missing')), { state: 'ok' }, 'a folder that does not exist yet');
  assert.deepEqual(checkFormat(home), { state: 'ok' }, 'no mark');
  const cases: Array<[string, string]> = [
    ['1', 'ok'], ['1\n', 'ok'], ['1\r\n', 'ok'], [' 1 ', 'ok'], ['01', 'ok'],
    ['2', 'newer'], ['2\n', 'newer'], ['999999', 'newer'],
    ['', 'unreadable'], ['abc', 'unreadable'], ['0', 'unreadable'], ['-1', 'unreadable'], ['1.5', 'unreadable'],
    ['9999999', 'unreadable'], ['{"format":2}', 'unreadable'], ['2 3', 'unreadable'], [`2${' '.repeat(40)}`, 'unreadable'],
  ];
  for (const [content, state] of cases) {
    writeFileSync(mark, content);
    assert.equal(checkFormat(home).state, state, JSON.stringify(content));
  }
  writeFileSync(mark, '7\n');
  assert.deepEqual(checkFormat(home), { state: 'newer', found: 7, supported: 1 });
  assert.deepEqual(formatWarning(home), { key: 'store.dataNewer', vars: { found: 7, supported: 1 } });
  writeFileSync(mark, 'basura <script>');
  assert.deepEqual(formatWarning(home), { key: 'store.formatUnreadable', vars: { supported: 1 } }, 'nothing of the file reaches the warning');
  rmSync(mark);
  mkdirSync(mark);
  assert.equal(checkFormat(home).state, 'unreadable', 'a directory');
  rmSync(mark, { recursive: true });
  const target = join(base, 'elsewhere');
  writeFileSync(target, '2\n');
  try {
    symlinkSync(target, mark);
  } catch {
    return; // Windows without the symlink privilege: nothing else to check.
  }
  assert.equal(checkFormat(home).state, 'unreadable', 'a symlink is not a mark');
});

test('a new data folder gets the mark in its wf: init commit; an existing one never does', (t) => {
  const home = makeHome(t);
  assert.equal(readFileSync(join(home, FORMAT_FILE), 'utf8'), '1\n');
  assert.equal(gitOut(home, 'show', '--name-only', '--format=%s', 'HEAD').split('\n').filter(Boolean).sort().join(','), '.gitignore,FORMAT,wf: init');
  assert.deepEqual(checkFormat(home), { state: 'ok' });
});

test('a folder written before the mark (0.1.0) opens as format 1 and reading it changes nothing', (t) => {
  const home = makeLegacyHome(t);
  const before = snapshot(home);
  assert.equal(before.status, '');
  assert.deepEqual(checkFormat(home), { state: 'ok' });
  assert.equal(formatWarning(home), null);
  assert.equal(initHome(home).created, false);
  const { tasks, unreadable } = listTasks(home, 'demo');
  assert.deepEqual(tasks.map((x) => `${x.id}:${x.status}`), ['WF-1:todo', 'WF-2:proposed']);
  assert.equal(unreadable.length, 0);
  assert.equal(readTask(home, 'demo', 'WF-1').data.estimate, 3);
  assert.equal(listErrors(home, 'demo').errors.length, 1);
  assert.equal(readError(home, 'demo', 'ERR-1').status, 'open');
  assert.deepEqual(snapshot(home), before, 'files, commits and git status are the same after only reading');
  assert.equal(existsSync(join(home, FORMAT_FILE)), false, 'opening never writes the mark');

  // Writing still works, keeps what this version does not know and does not add the mark either.
  updateTask(home, 'demo', 'WF-1', { title: 'Primera, renombrada' });
  assert.match(readFileSync(join(home, 'projects/demo/tasks/WF-1-primera.md'), 'utf8'), /^estimate: 3$/m);
  assert.equal(existsSync(join(home, FORMAT_FILE)), false);
  assert.equal(readFileSync(join(home, 'config.json'), 'utf8'), LEGACY_FILES['config.json']);
});

test('data from a newer format is read only: every write path refuses before touching anything', (t) => {
  const home = makeHome(t);
  makeProject(home);
  createTask(home, 'demo', { title: 'Una' }, 'web');
  createTask(home, 'demo', { title: 'Idea' }, 'mcp');
  createError(home, 'demo', { title: 'Falla', task: 'WF-1', context: 'npm test' });
  writeFileSync(join(home, FORMAT_FILE), '2\n');
  commitAll(home, 'wf: a newer version');
  const outside = mkdtempSync(join(tmpdir(), 'wf-format-out-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, 'shot.png'), PNG);
  const before = snapshot(home);

  const routes: Array<[string, () => unknown]> = [
    ['createTask', () => createTask(home, 'demo', { title: 'Otra' }, 'web')],
    ['updateTask', () => updateTask(home, 'demo', 'WF-1', { title: 'Nuevo título' })],
    ['setStatus', () => setStatus(home, 'demo', 'WF-2', 'discarded', 'web')],
    ['logProgress', () => logProgress(home, 'demo', 'WF-1', 'Avanzamos en WF-1: nada.')],
    ['appendLog', () => appendLog(home, 'demo', 'Una nota libre.')],
    ['createError', () => createError(home, 'demo', { title: 'Otro fallo', task: 'WF-1', context: 'npm run build' })],
    ['updateError', () => updateError(home, 'demo', 'ERR-1', { cause: 'Una causa.' })],
    ['noteError', () => noteError(home, 'demo', 'ERR-1', 'Una nota.')],
    ['resolveError', () => resolveError(home, 'demo', 'ERR-1', { solution: 'Arreglado.' })],
    ['discardError', () => discardError(home, 'demo', 'ERR-1', 'Falsa alarma.')],
    ['attachCapture', () => attachCapture(home, 'demo', { path: join(outside, 'shot.png'), alt: 'Captura', taskId: 'WF-1', allowedRoots: [outside] })],
    ['approveByChat', () => approveByChat(home, 'demo', 'WF-2', { userQuote: 'aprueba WF-2', verdict: 'clean' })],
    ['reviewTask', () => reviewTask(home, 'demo', 'WF-2')],
    ['createProject', () => createProject(home, { slug: 'otro', name: 'Otro', idPrefix: 'OT', localPath: 'D:/otro' })],
    ['registerByOrder', () => registerByOrder(home, outside, { slug: 'fuera', name: 'Fuera', idPrefix: 'FU', localPath: outside }, Date.now())],
    ['declineRegistration', () => declineRegistration(home, outside, new Date().toISOString())],
    ['recordOrders', () => recordOrders(home, 'demo', ['WF-2'], Date.now())],
    ['recordRegisterOrder', () => recordRegisterOrder(home, 'key', true, Date.now())],
    ['recordWebOrder', () => recordWebOrder(home, 'key', true, Date.now())],
    ['withLock + writeState', () => withLock(home, () => writeState(home, 'other.json', {}))],
  ];
  for (const [name, write] of routes) {
    assert.throws(write, (e: unknown) => isKey('store.dataNewer')(e) && (e as WayfinderError).vars.found === 2 && (e as WayfinderError).vars.supported === 1, name);
  }
  assert.deepEqual(snapshot(home), before, 'no file, commit or lock was left behind');

  // Reading goes on as usual.
  assert.deepEqual(listTasks(home, 'demo').tasks.map((x) => x.id), ['WF-1', 'WF-2']);
  assert.equal(readTask(home, 'demo', 'WF-1').title, 'Una');
  assert.equal(listErrors(home, 'demo').errors.length, 1);
});

test('a newer format written while waiting for the lock is refused under the lock, and the lock is released', async (t) => {
  const home = makeHome(t);
  makeProject(home);
  const lockDir = join(home, '.wayfinder.lock');
  mkdirSync(lockDir);
  // Another process holds the lock, raises FORMAT and then releases it.
  const other = spawn(
    process.execPath,
    ['-e', "setTimeout(() => { const fs = require('node:fs'); fs.writeFileSync(process.argv[1], '2\\n'); fs.rmSync(process.argv[2], { recursive: true, force: true }); }, 300)", join(home, FORMAT_FILE), lockDir],
    { stdio: 'ignore' },
  );
  const exited = new Promise((resolve) => other.on('close', resolve));
  let ran = false;
  assert.throws(() => withLock(home, () => (ran = true)), isKey('store.dataNewer'));
  assert.equal(await exited, 0);
  assert.equal(ran, false, 'nothing was written');
  assert.equal(existsSync(lockDir), false, 'the lock was released');
});

test('an unreadable mark is warned about but never blocks', (t) => {
  const home = makeHome(t);
  makeProject(home);
  writeFileSync(join(home, FORMAT_FILE), 'abc\n');
  assert.equal(checkFormat(home).state, 'unreadable');
  const { task } = createTask(home, 'demo', { title: 'Sigue funcionando' }, 'web');
  logProgress(home, 'demo', task.id, 'Avanzamos en WF-1: escrito.');
  assert.equal(readTask(home, 'demo', task.id).history?.includes('escrito'), true);
});

test('a task status from a newer version is listed and read, never rewritten, and still blocks', (t) => {
  const home = makeHome(t);
  makeProject(home);
  createTask(home, 'demo', { title: 'Depende de otra' }, 'web');
  const file = join(home, 'projects/demo/tasks/WF-5-pospuesta.md');
  writeFileSync(file, '---\nid: WF-5\ntitle: Pospuesta\nstatus: snoozed\npriority: high\norigin: user\ncreated: 2026-11-01T10:00:00+01:00\nupdated: 2026-11-01T10:00:00+01:00\nplan: ""\nsnooze_until: 2026-12-01\n---\n\nDescripción.\n');
  commitAll(home, 'wf: create WF-5 (newer version)');
  const { tasks, unreadable } = listTasks(home, 'demo');
  assert.deepEqual(tasks.map((x) => `${x.id}:${x.status}`), ['WF-1:todo', 'WF-5:snoozed']);
  assert.equal(unreadable.length, 0, 'it is not unreadable');
  const task = readTask(home, 'demo', 'WF-5');
  assert.equal(task.status, 'snoozed');
  assert.equal(reopenTarget(task), null);

  const hash = sha(file);
  const commits = commitCount(home);
  const outside = mkdtempSync(join(tmpdir(), 'wf-format-out-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, 'shot.png'), PNG);
  const writes: Array<[string, () => unknown]> = [
    ['updateTask', () => updateTask(home, 'demo', 'WF-5', { title: 'Otro' })],
    ['setStatus', () => setStatus(home, 'demo', 'WF-5', 'discarded', 'web')],
    ['setStatus mcp', () => setStatus(home, 'demo', 'WF-5', 'done', 'mcp')],
    ['logProgress', () => logProgress(home, 'demo', 'WF-5', 'Avanzamos en WF-5.')],
    ['attachCapture', () => attachCapture(home, 'demo', { path: join(outside, 'shot.png'), alt: 'Captura', taskId: 'WF-5', allowedRoots: [outside] })],
    ['approveByChat', () => approveByChat(home, 'demo', 'WF-5', { userQuote: 'aprueba WF-5', verdict: 'clean' })],
  ];
  for (const [name, write] of writes) {
    assert.throws(write, (e: unknown) => isKey('store.taskUnknownStatus')(e) && (e as WayfinderError).vars.status === 'snoozed', name);
  }
  assert.equal(sha(file), hash, 'the file is byte for byte the same');
  assert.equal(commitCount(home), commits);
  assert.equal(gitOut(home, 'status', '--porcelain'), '', 'no orphan capture or log line');

  // A task waiting for it stays blocked: only done frees a dependency.
  updateTask(home, 'demo', 'WF-1', { depends_on: ['WF-5'] });
  const byId = new Map(listTasks(home, 'demo').tasks.map((x) => [x.id, x]));
  assert.deepEqual(dependencyStates(readTask(home, 'demo', 'WF-1'), byId).filter(isBlocking).map((d) => d.id), ['WF-5']);
});
