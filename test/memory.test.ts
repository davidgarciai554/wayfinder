import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WayfinderError } from '../src/store/errors.ts';
import { appendLog } from '../src/store/log.ts';
import { historyEntry, historyIndex, MAX_SCAN_BYTES, search, timeline } from '../src/store/memory.ts';
import { createTask, logProgress } from '../src/store/tasks.ts';
import { createError, resolveError } from '../src/store/error-records.ts';
import { makeHome, makeProject } from './helpers.ts';

const isKey = (key: string) => (e: unknown) => e instanceof WayfinderError && e.key === key;
const at = (iso: string) => () => new Date(iso);

function seed(t: Parameters<typeof makeHome>[0]) {
  const home = makeHome(t);
  makeProject(home);
  createTask(home, 'demo', { title: 'Filtro por prioridad', body: 'Decidir dónde va el selector' }, 'web', at('2026-10-20T09:00:00'));
  createTask(home, 'demo', { title: 'Idea de exportar', body: 'Exportar a CSV (a+b)*' }, 'mcp', at('2026-10-20T09:30:00'));
  logProgress(home, 'demo', 'WF-1', 'Avanzamos en el filtro.\nDecidimos usar un select nativo.', { next: 'tests' }, at('2026-10-21T10:00:00'));
  logProgress(home, 'demo', 'WF-1', 'Avanzamos: tests en verde.', {}, at('2026-10-22T11:00:00'));
  appendLog(home, 'demo', 'Revisión general del repositorio.', { clock: at('2026-10-22T12:00:00') });
  return home;
}

test('history index lists the entries and any one can be read in full', (t) => {
  const home = seed(t);
  const { entries, total } = historyIndex(home, 'demo', 'WF-1');
  assert.equal(total, 3);
  assert.deepEqual(entries.map((e) => [e.n, e.date]), [[1, '2026-10-20'], [2, '2026-10-21'], [3, '2026-10-22']]);
  assert.match(historyEntry(home, 'demo', 'WF-1', 2).entry.text, /select nativo[\s\S]*- Next: tests/);
  assert.throws(() => historyEntry(home, 'demo', 'WF-1', 9), isKey('store.historyEntryNotFound'));
  assert.throws(() => historyIndex(home, 'demo', 'WF-9'), isKey('store.taskNotFound'));
});

test('timeline returns the most recent log days, newest first', (t) => {
  const home = seed(t);
  const days = timeline(home, 'demo', 7);
  assert.deepEqual(days.map((d) => d[0].day), ['2026-10-22', '2026-10-21']);
  assert.deepEqual(days[0].map((e) => [e.time, e.id]), [['11:00', 'WF-1'], ['12:00', undefined]]);
  assert.match(days[0][0].text, /^\[WF-1 · Filtro por prioridad\]\(#\/demo\/task\/WF-1\/3\) — Avanzamos: tests en verde\.$/);
  assert.equal(timeline(home, 'demo', 1).length, 1);
});

test('search is literal, case-insensitive, newest first, with tasks last and proposals marked', (t) => {
  const home = seed(t);
  const r = search(home, 'demo', 'SELECT', 10);
  assert.deepEqual(r.hits.map((h) => [h.kind, h.id, h.entry]), [['history', 'WF-1', 2], ['task', 'WF-1', undefined]]);
  assert.match(r.hits[0].snippet, /select nativo/);
  assert.equal(r.truncated, false);
  const regex = search(home, 'demo', '(a+b)*', 10);
  assert.deepEqual(regex.hits.map((h) => [h.kind, h.id, h.proposed]), [['task', 'WF-2', true]]);
  const log = search(home, 'demo', 'revisión general', 10).hits;
  assert.deepEqual(log.map((h) => [h.kind, h.when]), [['log', '2026-10-22 12:00']]);
  assert.deepEqual(search(home, 'demo', 'no existe', 10).hits, []);
  assert.equal(search(home, 'demo', 'avanzamos', 1).hits.length, 1);
  assert.equal(search(home, 'demo', 'avanzamos', 50).hits.length <= 20, true);
});

test('search stops at its read budget and says so', (t) => {
  const home = seed(t);
  writeFileSync(join(home, 'projects/demo/log/2026-10-23.md'), `# 2026-10-23\n\n## 09:00\n\n${'x'.repeat(MAX_SCAN_BYTES)}\n`);
  const r = search(home, 'demo', 'avanzamos', 10);
  assert.equal(r.truncated, true);
});

test('search lists error records first, newest first, at most 5, with their status', (t) => {
  const home = seed(t);
  for (let i = 1; i <= 7; i++) {
    createError(home, 'demo', { title: `Fallo ${i}`, task: 'WF-1', context: `EPERM al borrar el lock, intento ${i}` }, at(`2026-10-23T09:0${i}:00`));
  }
  resolveError(home, 'demo', 'ERR-7', { solution: 'reintentar', validation: 'npm test' }, { clock: at('2026-10-23T10:00:00') });
  logProgress(home, 'demo', 'WF-1', 'Avanzamos: EPERM otra vez.', {}, at('2026-10-23T11:00:00'));
  const r = search(home, 'demo', 'eperm', 20);
  assert.deepEqual(r.hits.slice(0, 5).map((h) => [h.kind, h.id, h.status]), [
    ['error', 'ERR-7', 'resolved'],
    ['error', 'ERR-6', 'open'],
    ['error', 'ERR-5', 'open'],
    ['error', 'ERR-4', 'open'],
    ['error', 'ERR-3', 'open'],
  ]);
  assert.deepEqual(r.hits.slice(5).map((h) => h.kind).sort(), ['history', 'log']);
  assert.ok(r.hits.every((h) => h.snippet.length <= 202));
  assert.deepEqual(search(home, 'demo', 'SELECT', 10).hits.map((h) => h.kind), ['history', 'task'], 'unchanged without matching errors');
});
