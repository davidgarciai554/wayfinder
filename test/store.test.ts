import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, serializeFrontmatter } from '../src/store/frontmatter.ts';
import { initHome } from '../src/store/init.ts';
import { appendLog } from '../src/store/log.ts';
import { assertSlug, safeJoin } from '../src/store/paths.ts';
import { createProject } from '../src/store/project.ts';
import { createTask, listTasks, readTask, setStatus, updateTask } from '../src/store/tasks.ts';
import { WayfinderError } from '../src/store/errors.ts';
import { commitCount, fixedClock, gitOut, makeHome, makeProject, sha, tree } from './helpers.ts';

const isKey = (key: string) => (e: unknown) => e instanceof WayfinderError && e.key === key;

test('frontmatter tolerates BOM/CRLF, keeps unknown keys and is idempotent', () => {
  const raw = '\uFEFF---\r\nid: WF-1\r\ntitle: Ñandú con acentos\r\ncustom: keep me\r\n---\r\n\r\nCuerpo\r\n';
  const parsed = parseFrontmatter(raw);
  assert.ok(!('error' in parsed));
  assert.equal(parsed.data.custom, 'keep me');
  assert.equal(parsed.body, 'Cuerpo\n');
  const once = serializeFrontmatter(parsed.data, parsed.body);
  assert.doesNotMatch(once, /\r|\uFEFF/);
  const again = parseFrontmatter(once);
  assert.ok(!('error' in again));
  assert.equal(serializeFrontmatter(again.data, again.body), once);
});

test('init is idempotent and an existing home is left untouched', (t) => {
  const home = makeHome(t);
  const before = tree(home);
  const commits = commitCount(home);
  const second = initHome(home);
  assert.equal(second.created, false);
  assert.deepEqual(tree(home), before);
  assert.equal(commitCount(home), commits);
  assert.match(readFileSync(join(home, '.gitignore'), 'utf8'), /\.state\//);
  assert.equal(gitOut(home, 'log', '-1', '--format=%s'), 'wf: init');
  assert.equal(gitOut(home, 'remote'), '');
});

test('init refuses a non-empty folder that is not a Wayfinder home', (t) => {
  const home = makeHome(t);
  const other = join(home, '..', 'other');
  mkdirSync(other);
  writeFileSync(join(other, 'notes.txt'), 'x');
  assert.throws(() => initHome(other), isKey('init.notEmpty'));
});

test('MCP creates proposed/claude and the web creates todo/user, with all 8 fields', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const clock = fixedClock();
  const a = createTask(home, 'demo', { title: 'Añadir filtro', body: 'Detalle' }, 'mcp', clock).task;
  const b = createTask(home, 'demo', { title: 'Otra', priority: 'high' }, 'web', clock).task;
  assert.equal(a.id, 'WF-1');
  assert.equal(a.status, 'proposed');
  assert.equal(a.origin, 'claude');
  assert.equal(b.id, 'WF-2');
  assert.equal(b.status, 'todo');
  assert.equal(b.origin, 'user');
  const parsed = parseFrontmatter(readFileSync(join(home, a.file), 'utf8'));
  assert.ok(!('error' in parsed));
  assert.deepEqual(Object.keys(parsed.data), ['id', 'title', 'status', 'priority', 'origin', 'created', 'updated', 'plan']);
  assert.match(a.file, /^projects\/demo\/tasks\/WF-1-anadir-filtro\.md$/);
});

test('created never changes and updated changes on every write', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const clock = fixedClock();
  const { task } = createTask(home, 'demo', { title: 'T' }, 'web', clock);
  const updated = updateTask(home, 'demo', task.id, { priority: 'high' }, { clock }).task;
  assert.equal(updated.created, task.created);
  assert.notEqual(updated.updated, task.updated);
});

test('an invalid transition is rejected and leaves the file and history intact', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const { task } = createTask(home, 'demo', { title: 'T' }, 'mcp');
  const file = join(home, task.file);
  const hash = sha(file);
  const commits = commitCount(home);
  assert.throws(() => setStatus(home, 'demo', task.id, 'done', 'mcp'), isKey('store.invalidTransition'));
  assert.throws(() => setStatus(home, 'demo', task.id, 'in-progress', 'mcp'), isKey('store.invalidTransition'));
  assert.throws(() => setStatus(home, 'demo', task.id, 'todo', 'mcp'), isKey('store.invalidTransition'));
  assert.equal(sha(file), hash);
  assert.equal(commitCount(home), commits);
});

test('the plan rule guards todo → in-progress', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const id = createTask(home, 'demo', { title: 'T' }, 'web').task.id;
  assert.throws(() => setStatus(home, 'demo', id, 'in-progress', 'mcp', { planExists: () => true }), isKey('store.planRequired'));
  assert.throws(() => updateTask(home, 'demo', id, { plan: 'Planes/x.md' }, { planExists: () => false }), isKey('store.planNotFound'));
  updateTask(home, 'demo', id, { plan: 'Planes/x.md' }, { planExists: () => true });
  assert.throws(() => setStatus(home, 'demo', id, 'in-progress', 'mcp'), isKey('store.planUnverifiable'));
  assert.equal(setStatus(home, 'demo', id, 'in-progress', 'mcp', { planExists: () => true }).task.status, 'in-progress');

  const trivial = createTask(home, 'demo', { title: 'Typo' }, 'web').task.id;
  assert.throws(() => setStatus(home, 'demo', trivial, 'in-progress', 'mcp', { trivial: true }), isKey('store.trivialNeedsNote'));
  const r = setStatus(home, 'demo', trivial, 'in-progress', 'mcp', { trivial: true, note: 'Corrección de una errata' });
  assert.equal(r.task.status, 'in-progress');
  const [logName] = readdirSync(join(home, 'projects/demo/log'));
  const log = readFileSync(join(home, 'projects/demo/log', logName), 'utf8');
  assert.match(log, /trivial: true/);
  assert.match(log, /Corrección de una errata/);
});

test('notes are required where the table says so and the web approves with approvedVia: web', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const a = createTask(home, 'demo', { title: 'Idea' }, 'mcp').task.id;
  assert.throws(() => setStatus(home, 'demo', a, 'discarded', 'mcp'), isKey('store.noteRequired'));
  const b = createTask(home, 'demo', { title: 'Idea 2' }, 'mcp').task.id;
  const approved = setStatus(home, 'demo', b, 'todo', 'web').task;
  assert.equal(approved.approvedVia, 'web');
  assert.equal(readTask(home, 'demo', b).approvedVia, 'web');
});

test('corrupt task files are reported as unreadable without hiding the rest', (t) => {
  const home = makeHome(t);
  makeProject(home);
  createTask(home, 'demo', { title: 'Buena' }, 'web');
  const dir = join(home, 'projects/demo/tasks');
  writeFileSync(join(dir, 'WF-90-yaml.md'), '---\nid: [unclosed\n---\n');
  writeFileSync(join(dir, 'WF-91-noid.md'), '---\ntitle: Sin id\nstatus: todo\n---\n');
  writeFileSync(join(dir, 'WF-92-status.md'), '---\nid: WF-92\ntitle: X\nstatus: blocked\n---\n');
  const { tasks, unreadable } = listTasks(home, 'demo');
  assert.equal(tasks.length, 1);
  assert.equal(unreadable.length, 3);
  assert.match(unreadable.map((u) => u.reason).join('|'), /invalid YAML/);
  assert.match(unreadable.map((u) => u.reason).join('|'), /unknown status: blocked/);
  // New IDs never collide with an unreadable file that still has a numeric prefix.
  assert.equal(createTask(home, 'demo', { title: 'Nueva' }, 'web').task.id, 'WF-93');
});

test('secrets are rejected in titles, bodies, notes and log entries', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const token = `ghp_${'a'.repeat(36)}`;
  assert.throws(() => createTask(home, 'demo', { title: `token ${token}` }, 'mcp'), isKey('store.secretRejected'));
  assert.throws(() => createTask(home, 'demo', { title: 'ok', body: 'password=hunter2' }, 'mcp'), isKey('store.secretRejected'));
  assert.throws(() => appendLog(home, 'demo', '-----BEGIN RSA PRIVATE KEY-----'), isKey('store.secretRejected'));
  assert.throws(() => appendLog(home, 'demo', 'clone https://user:pass@example.com/repo'), isKey('store.secretRejected'));
  assert.equal(listTasks(home, 'demo').tasks.length, 0);
});

test('malicious slugs, traversal and links never write outside WAYFINDER_HOME', (t) => {
  const home = makeHome(t);
  const before = tree(join(home, '..'));
  for (const slug of ['../evil', '..', 'a/b', 'a\\b', 'con', 'NUL', 'nul', 'x:y', 'dot.', 'space ', 'C:\\x', '/abs', 'UPPER', '']) {
    assert.throws(() => assertSlug(slug), isKey('store.invalidSlug'), slug);
    assert.throws(() => createProject(home, { slug, name: 'x', idPrefix: 'EV', localPath: 'x' }), isKey('store.invalidSlug'), slug);
  }
  assert.throws(() => safeJoin(home, '..', 'outside.md'), isKey('store.pathOutsideHome'));
  assert.throws(() => safeJoin(home, 'C:\\Windows\\x'), isKey('store.pathOutsideHome'));
  assert.deepEqual(tree(join(home, '..')), before);

  // A junction (Windows) or symlink planted inside the home is refused.
  const outside = join(home, '..', 'outside');
  mkdirSync(outside);
  mkdirSync(join(home, 'projects'), { recursive: true });
  try {
    symlinkSync(outside, join(home, 'projects', 'linked'), 'junction');
  } catch {
    t.diagnostic('junctions not available; skipped');
    return;
  }
  assert.throws(() => createProject(home, { slug: 'linked', name: 'x', idPrefix: 'LK', localPath: 'x' }), isKey('store.symlinkRejected'));
  assert.equal(existsSync(join(outside, 'PROJECT.md')), false);
});

test('a burst of writes converges to a consistent final state', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const id = createTask(home, 'demo', { title: 'Burst' }, 'web').task.id;
  for (let i = 0; i < 10; i++) updateTask(home, 'demo', id, { body: `v${i}` });
  const task = readTask(home, 'demo', id);
  assert.equal(task.body, 'v9\n');
  assert.equal(gitOut(home, 'status', '--porcelain'), '');
});

test('expectedUpdated detects a concurrent change (conflict)', (t) => {
  const home = makeHome(t);
  makeProject(home);
  const clock = fixedClock();
  const { task } = createTask(home, 'demo', { title: 'C' }, 'web', clock);
  updateTask(home, 'demo', task.id, { body: 'changed by Claude' }, { clock });
  assert.throws(() => updateTask(home, 'demo', task.id, { body: 'stale' }, { expectedUpdated: task.updated, clock }), isKey('store.conflict'));
});
