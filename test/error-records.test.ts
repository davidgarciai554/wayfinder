import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createError,
  errorsForTask,
  listErrors,
  MAX_FIELD,
  MAX_OUTPUT,
  noteError,
  readError,
  resolveError,
  unescapeField,
  updateError,
} from '../src/store/error-records.ts';
import { WayfinderError } from '../src/store/errors.ts';
import { parseEntries } from '../src/store/history.ts';
import { createProject } from '../src/store/project.ts';
import { createTask, readTask, setStatus } from '../src/store/tasks.ts';
import { commitCount, fixedClock, gitOut, makeHome, makeProject, sha, tree } from './helpers.ts';

const isKey = (key: string) => (e: unknown) => e instanceof WayfinderError && e.key === key;

function setup(t: { after: (fn: () => void) => void }) {
  const home = makeHome(t);
  makeProject(home);
  const clock = fixedClock();
  const task = createTask(home, 'demo', { title: 'Tarea con fallos' }, 'mcp', clock).task.id;
  return { home, clock, task };
}

const base = (task: string) => ({ title: 'El build falla con require dinámico', task, context: 'npm run build en Windows' });

test('creating an error writes its file, one commit and leaves the task file untouched', (t) => {
  const { home, clock, task } = setup(t);
  const taskFile = join(home, readTask(home, 'demo', task).file);
  const before = sha(taskFile);
  const commits = commitCount(home);
  const { error, duplicates } = createError(
    home,
    'demo',
    { ...base(task), output: 'Error: Dynamic require of "process"', files: ['scripts\\build.mjs', './src/a.ts'] },
    clock,
  );
  assert.equal(error.id, 'ERR-1');
  assert.equal(error.status, 'open');
  assert.equal(error.causeKind, 'hypothesis');
  assert.deepEqual(error.files, ['scripts/build.mjs', 'src/a.ts']);
  assert.deepEqual(duplicates, []);
  assert.equal(commitCount(home), commits + 1);
  assert.equal(gitOut(home, 'log', '-1', '--format=%s'), 'wf: error create ERR-1');
  assert.equal(gitOut(home, 'status', '--porcelain'), '');
  assert.equal(sha(taskFile), before);
  const raw = readFileSync(join(home, error.file), 'utf8');
  assert.match(raw, /^## Contexto\n\nnpm run build en Windows$/m);
  assert.match(raw, /^## Salida observada$/m);
  assert.doesNotMatch(raw, /^## Causa$/m);
  const again = readError(home, 'demo', 'ERR-1');
  assert.equal(again.fields.output, 'Error: Dynamic require of "process"');
  assert.equal(parseEntries(again.history).length, 1);
  assert.deepEqual(errorsForTask(home, 'demo', task).map((e) => e.id), ['ERR-1']);
});

test('the task is required and must exist; nothing is written otherwise', (t) => {
  const { home, clock, task } = setup(t);
  const before = tree(home);
  assert.throws(() => createError(home, 'demo', { ...base(task), task: '' }, clock), isKey('store.errorTaskRequired'));
  assert.throws(() => createError(home, 'demo', { ...base(task), task: 'WF-99' }, clock), isKey('store.taskNotFound'));
  assert.throws(() => createError(home, 'demo', { ...base(task), task: 'nope' }, clock), isKey('store.invalidId'));
  assert.throws(() => createError(home, 'demo', { ...base(task), context: '  ' }, clock), isKey('store.errorContextRequired'));
  assert.deepEqual(tree(home), before);
});

test('ERR-1 and ERR-10 are never confused', (t) => {
  const { home, clock, task } = setup(t);
  for (let i = 1; i <= 10; i++) createError(home, 'demo', { ...base(task), title: `Fallo número ${i}` }, clock);
  assert.equal(readError(home, 'demo', 'ERR-1').title, 'Fallo número 1');
  assert.equal(readError(home, 'demo', 'ERR-10').title, 'Fallo número 10');
  assert.deepEqual(listErrors(home, 'demo').errors.map((e) => e.id).slice(-2), ['ERR-9', 'ERR-10']);
  assert.throws(() => readError(home, 'demo', 'ERR-11'), isKey('store.errorNotFound'));
  assert.throws(() => readError(home, 'demo', 'WF-1'), isKey('store.invalidErrorId'));
});

test('limits: exact limit passes, one more is rejected without writing', (t) => {
  const { home, clock, task } = setup(t);
  createError(home, 'demo', { ...base(task), title: 't'.repeat(200), context: 'c'.repeat(MAX_FIELD), output: 'o'.repeat(MAX_OUTPUT) }, clock);
  const before = tree(home);
  assert.throws(() => createError(home, 'demo', { ...base(task), title: 't'.repeat(201) }, clock), isKey('store.invalidTitle'));
  assert.throws(() => createError(home, 'demo', { ...base(task), context: 'c'.repeat(MAX_FIELD + 1) }, clock), isKey('store.errorFieldTooLong'));
  assert.throws(() => createError(home, 'demo', { ...base(task), output: 'o'.repeat(MAX_OUTPUT + 1) }, clock), isKey('store.errorFieldTooLong'));
  const big = 'x'.repeat(MAX_FIELD);
  assert.throws(
    () => createError(home, 'demo', { ...base(task), context: big, reproduction: big, output: big, cause: big, solution: big, validation: 'v' }, clock),
    isKey('store.errorFieldsTooLong'),
  );
  assert.deepEqual(tree(home), before);
});

test('headings inside fields are escaped and cannot forge sections or history', (t) => {
  const { home, clock, task } = setup(t);
  const { error } = createError(home, 'demo', { ...base(task), output: 'línea\n## Causa\nfalsa\n## Historial\n### 2026-01-01 10:00' }, clock);
  const read = readError(home, 'demo', error.id);
  assert.equal(read.fields.cause, '');
  assert.match(read.fields.output, /^\\## Causa$/m);
  assert.equal(parseEntries(read.history).length, 1);
});

test('file paths must be relative to the repository', (t) => {
  const { home, clock, task } = setup(t);
  for (const bad of ['../fuera.ts', 'src/../../x', '/etc/passwd', 'C:\\Users\\x\\a.ts', '\\\\server\\share\\a', '', 'a'.repeat(201)]) {
    assert.throws(() => createError(home, 'demo', { ...base(task), files: [bad] }, clock), isKey('store.errorFileInvalid'), bad);
  }
  assert.throws(
    () => createError(home, 'demo', { ...base(task), files: Array.from({ length: 21 }, (_, i) => `f${i}.ts`) }, clock),
    isKey('store.errorFilesTooMany'),
  );
});

test('secrets are rejected in any field, title, file or note and nothing is written', (t) => {
  const { home, clock, task } = setup(t);
  const secret = 'password=hunter2xyz';
  const before = tree(home);
  assert.throws(() => createError(home, 'demo', { ...base(task), output: `fallo ${secret}` }, clock), isKey('store.secretRejected'));
  assert.throws(() => createError(home, 'demo', { ...base(task), title: `Fallo ${secret}` }, clock), isKey('store.secretRejected'));
  assert.throws(() => createError(home, 'demo', { ...base(task), files: [`src/${secret}`] }, clock), isKey('store.secretRejected'));
  assert.deepEqual(tree(home), before);
  const { error } = createError(home, 'demo', base(task), clock);
  const file = join(home, error.file);
  const hash = sha(file);
  assert.throws(() => noteError(home, 'demo', error.id, `otra vez ${secret}`, clock), isKey('store.secretRejected'));
  assert.throws(() => updateError(home, 'demo', error.id, { cause: secret }, { clock }), isKey('store.secretRejected'));
  assert.equal(sha(file), hash);
});

test('a note records a recurrence in the same error and never creates another file', (t) => {
  const { home, clock, task } = setup(t);
  const { error } = createError(home, 'demo', base(task), clock);
  const commits = commitCount(home);
  noteError(home, 'demo', error.id, 'Recurrencia: vuelve a fallar en Node 24', clock);
  const read = readError(home, 'demo', error.id);
  const entries = parseEntries(read.history);
  assert.equal(entries.length, 2);
  assert.match(entries[1].text, /Recurrencia/);
  assert.equal(listErrors(home, 'demo').errors.length, 1);
  assert.equal(commitCount(home), commits + 1);
  assert.equal(gitOut(home, 'log', '-1', '--format=%s'), `wf: error note ${error.id}`);
});

test('update changes only editable fields and records which ones', (t) => {
  const { home, clock, task } = setup(t);
  const { error } = createError(home, 'demo', base(task), clock);
  for (const field of ['title', 'task', 'context', 'reproduction', 'output'] as const) {
    assert.throws(() => updateError(home, 'demo', error.id, { [field]: 'x' }, { clock }), isKey('store.errorFieldImmutable'), field);
  }
  assert.throws(() => updateError(home, 'demo', error.id, {}, { clock }), isKey('store.errorNothingToUpdate'));
  assert.throws(() => updateError(home, 'demo', error.id, { causeKind: 'maybe' }, { clock }), isKey('store.invalidCauseKind'));
  const { error: updated } = updateError(home, 'demo', error.id, { cause: 'yaml usa require', causeKind: 'confirmed', files: ['scripts/build.mjs'] }, { clock });
  assert.equal(updated.causeKind, 'confirmed');
  assert.equal(updated.fields.context, 'npm run build en Windows');
  assert.match(parseEntries(updated.history).at(-1)!.text, /^Updated\. Fields: cause, cause_kind, files\.$/);
});

test('resolve needs solution and validation, is idempotent and reopen needs a note', (t) => {
  const { home, clock, task } = setup(t);
  const { error } = createError(home, 'demo', base(task), clock);
  assert.throws(() => resolveError(home, 'demo', error.id, { solution: 'banner' }, { clock }), isKey('store.errorResolveNeedsSolution'));
  assert.equal(readError(home, 'demo', error.id).status, 'open');
  const done = resolveError(home, 'demo', error.id, { solution: 'banner con createRequire', validation: 'npm test 54/54' }, { clock });
  assert.equal(done.written, true);
  assert.equal(done.error.status, 'resolved');
  const commits = commitCount(home);
  const again = resolveError(home, 'demo', error.id, {}, { clock });
  assert.equal(again.written, false);
  assert.equal(again.warnings[0].key, 'store.errorAlreadyResolved');
  assert.equal(commitCount(home), commits);
  assert.throws(() => updateError(home, 'demo', error.id, {}, { reopen: true, clock }), isKey('store.errorReopenNeedsNote'));
  const reopened = updateError(home, 'demo', error.id, {}, { reopen: true, note: 'Vuelve en Linux', clock }).error;
  assert.equal(reopened.status, 'open');
  assert.match(parseEntries(reopened.history).at(-1)!.text, /^Reopened\.\n\nVuelve en Linux$/);
  assert.throws(() => updateError(home, 'demo', error.id, {}, { reopen: true, note: 'x', clock }), isKey('store.errorNotResolved'));
  resolveError(home, 'demo', error.id, {}, { clock });
  const file = join(home, error.file);
  const hash = sha(file);
  assert.throws(() => updateError(home, 'demo', error.id, { solution: '' }, { clock }), isKey('store.errorResolvedKeepsEvidence'));
  assert.throws(() => updateError(home, 'demo', error.id, { validation: ' ' }, { clock }), isKey('store.errorResolvedKeepsEvidence'));
  assert.equal(sha(file), hash, 'a resolved error keeps its solution and validation');
  updateError(home, 'demo', error.id, { result: 'Sin recurrencias en una semana' }, { clock });
});

test('fields keep their exact text, including lines that start with "\\#"', (t) => {
  const { home, clock, task } = setup(t);
  const output = '# 1 failing\n\\# literal\n  ## indentado';
  const { error } = createError(home, 'demo', { ...base(task), output }, clock);
  const stored = readError(home, 'demo', error.id).fields.output;
  assert.doesNotMatch(stored, /^\s*#/m, 'no line can start a heading');
  assert.equal(unescapeField(stored), output);
});

test('create reports up to 3 open possible duplicates without blocking', (t) => {
  const { home, clock, task } = setup(t);
  for (let i = 0; i < 4; i++) createError(home, 'demo', { ...base(task), output: `EPERM al borrar el lock ${i}` }, clock);
  const resolved = createError(home, 'demo', { ...base(task), title: 'Otro distinto', output: 'EPERM al borrar el lock' }, clock).error;
  resolveError(home, 'demo', resolved.id, { solution: 's', validation: 'v' }, { clock });
  const { error, duplicates } = createError(home, 'demo', { ...base(task), title: 'Nuevo', output: 'EPERM al borrar el lock\nmás' }, clock);
  assert.equal(error.id, 'ERR-6');
  assert.deepEqual(duplicates.map((d) => d.id), ['ERR-1', 'ERR-2', 'ERR-3']);
});

test('errors stay visible when the task is done or discarded; unreadable files do not break the list', (t) => {
  const { home, clock, task } = setup(t);
  createError(home, 'demo', base(task), clock);
  setStatus(home, 'demo', task, 'discarded', 'mcp', { note: 'ya no aplica', clock });
  assert.equal(errorsForTask(home, 'demo', task).length, 1);
  writeFileSync(join(home, 'projects/demo/errors/ERR-2-roto.md'), '---\nid: [\n---\n');
  const { errors, unreadable } = listErrors(home, 'demo');
  assert.equal(errors.length, 1);
  assert.equal(unreadable.length, 1);
});

test('a project without errors/ lists nothing and the ERR prefix is reserved', (t) => {
  const home = makeHome(t);
  makeProject(home);
  assert.deepEqual(listErrors(home, 'demo'), { errors: [], unreadable: [] });
  assert.equal(existsSync(join(home, 'projects/demo/errors')), false);
  assert.throws(() => createProject(home, { slug: 'otro', name: 'Otro', idPrefix: 'ERR', localPath: 'D:/otro' }), isKey('store.reservedIdPrefix'));
  makeProject(home, 'otro', 'ER');
});
