import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEntries } from '../src/store/history.ts';
import { createTask, listTasks, readTask } from '../src/store/tasks.ts';
import { commitCount, gitOut, makeHome, makeProject } from './helpers.ts';

const worker = fileURLToPath(new URL('./fixtures/worker.ts', import.meta.url));

function run(args: string[]): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [worker, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

test('20 concurrent processes create 20 distinct IDs and 20 commits', { timeout: 120_000 }, async (t) => {
  const home = makeHome(t);
  makeProject(home);
  const before = commitCount(home);
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => run(['create', home, 'demo', String(i)])));
  for (const r of results) assert.equal(r.code, 0, r.err);
  const ids = results.map((r) => r.out);
  assert.equal(new Set(ids).size, 20);
  assert.equal(listTasks(home, 'demo').tasks.length, 20);
  assert.equal(commitCount(home), before + 20);
  assert.equal(gitOut(home, 'status', '--porcelain'), '');
});

test('20 concurrent reviews are all recorded in .state/reviews.json', { timeout: 120_000 }, async (t) => {
  const home = makeHome(t);
  makeProject(home);
  const ids = Array.from({ length: 20 }, (_, i) => createTask(home, 'demo', { title: `R${i}` }, 'mcp').task.id);
  const results = await Promise.all(ids.map((id) => run(['review', home, 'demo', id])));
  for (const r of results) assert.equal(r.code, 0, r.err);
  const state = JSON.parse(readFileSync(join(home, '.state', 'reviews.json'), 'utf8'));
  assert.deepEqual(Object.keys(state.demo).sort(), [...ids].sort());
  // .state/ is ignored by git.
  assert.equal(gitOut(home, 'status', '--porcelain'), '');
});

test('20 concurrent progress entries and description edits lose nothing', { timeout: 120_000 }, async (t) => {
  const home = makeHome(t);
  makeProject(home);
  const id = createTask(home, 'demo', { title: 'Compartida' }, 'web').task.id;
  const before = commitCount(home);
  const jobs = Array.from({ length: 20 }, (_, i) => run([i % 4 === 0 ? 'update' : 'progress', home, 'demo', id, String(i)]));
  const results = await Promise.all(jobs);
  for (const r of results) assert.equal(r.code, 0, r.err);
  const task = readTask(home, 'demo', id);
  const texts = parseEntries(task.history).map((e) => e.text);
  const expected = Array.from({ length: 20 }, (_, i) => i).filter((i) => i % 4 !== 0).map((i) => `Avance ${i}`);
  assert.deepEqual([...texts.slice(1)].sort(), expected.sort(), 'every progress entry is kept');
  assert.match(task.body, /^Descripción \d+\n$/);
  assert.equal(commitCount(home), before + 20);
  assert.equal(gitOut(home, 'status', '--porcelain'), '');
});
