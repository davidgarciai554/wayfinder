// Read-only views over task histories and the log, for wf_history and wf_search.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WayfinderError } from './errors.ts';
import { parseEntries, type HistoryEntry } from './history.ts';
import { projectDir, safeJoin } from './paths.ts';
import { listTasks, readTask, type Task } from './tasks.ts';
import { flatten } from './text.ts';

export const MAX_INDEX = 30;
export const MAX_DAYS = 30;
export const MAX_RESULTS = 20;
/** wf_search reads at most this much: a linear scan, fine for a personal store. Index it only if measured slow. */
export const MAX_SCAN_BYTES = 2 * 1024 * 1024;

export interface LogEntry {
  day: string;
  time: string;
  id?: string;
  text: string;
}

const firstLine = (text: string) => text.trim().split('\n')[0] ?? '';

export function historyIndex(home: string, slug: string, id: string): { task: Task; entries: HistoryEntry[]; total: number } {
  const task = readTask(home, slug, id);
  const all = parseEntries(task.history);
  return { task, entries: all.slice(-MAX_INDEX), total: all.length };
}

export function historyEntry(home: string, slug: string, id: string, n: number): { task: Task; entry: HistoryEntry } {
  const task = readTask(home, slug, id);
  const all = parseEntries(task.history);
  const entry = all.find((e) => e.n === n);
  if (!entry) throw new WayfinderError('store.historyEntryNotFound', { id, entry: n, total: all.length });
  return { task, entry };
}

function logDays(home: string, slug: string): string[] {
  const dir = safeJoin(projectDir(home, slug), 'log');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))
    .map((n) => n.slice(0, 10))
    .sort()
    .reverse();
}

export function parseLog(day: string, raw: string): LogEntry[] {
  const text = raw.replace(/\r\n?/g, '\n');
  const heads = [...text.matchAll(/^## (\d{2}:\d{2})(?: · ([A-Z]{2,6}-\d+))?[ \t]*$/gm)];
  return heads.map((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    return { day, time: m[1], id: m[2], text: text.slice((m.index ?? 0) + m[0].length, end).trim() };
  });
}

function readLog(home: string, slug: string, day: string): string {
  return readFileSync(safeJoin(projectDir(home, slug), 'log', `${day}.md`), 'utf8');
}

/** The most recent `days` log files that exist, newest first; one summary line per entry. */
export function timeline(home: string, slug: string, days: number): LogEntry[][] {
  return logDays(home, slug)
    .slice(0, Math.min(Math.max(days, 1), MAX_DAYS))
    .map((day) => parseLog(day, readLog(home, slug, day)).map((e) => ({ ...e, text: firstLine(e.text) })));
}

export interface SearchHit {
  kind: 'history' | 'task' | 'log';
  id?: string;
  entry?: number;
  /** "YYYY-MM-DD HH:MM" for history and log hits. */
  when?: string;
  proposed?: boolean;
  snippet: string;
}

function snippet(text: string, at: number, length: number): string {
  const start = Math.max(0, at - 80);
  const end = Math.min(text.length, at + length + 80);
  return `${start > 0 ? '…' : ''}${flatten(text.slice(start, end), 200)}${end < text.length ? '…' : ''}`;
}

/** Case-insensitive literal search (never a regular expression) over tasks, histories and the log. */
export function search(home: string, slug: string, query: string, limit: number): { hits: SearchHit[]; truncated: boolean } {
  const needle = query.toLowerCase();
  const find = (text: string) => text.toLowerCase().indexOf(needle);
  const dated: SearchHit[] = [];
  const tasks: SearchHit[] = [];
  let budget = MAX_SCAN_BYTES;
  let truncated = false;
  const spend = (bytes: number) => {
    if (bytes > budget) {
      truncated = true;
      return false;
    }
    budget -= bytes;
    return true;
  };

  for (const day of logDays(home, slug)) {
    const file = safeJoin(projectDir(home, slug), 'log', `${day}.md`);
    if (!spend(statSync(file).size)) break;
    for (const e of parseLog(day, readFileSync(file, 'utf8'))) {
      const at = find(e.text);
      if (at >= 0) dated.push({ kind: 'log', id: e.id, when: `${day} ${e.time}`, snippet: snippet(e.text, at, needle.length) });
    }
  }
  if (!truncated) {
    const dir = safeJoin(projectDir(home, slug), 'tasks');
    const sizes = existsSync(dir) ? readdirSync(dir).reduce((sum, n) => sum + statSync(join(dir, n)).size, 0) : 0;
    if (spend(sizes)) {
      for (const task of listTasks(home, slug).tasks) {
        const proposed = task.status === 'proposed';
        const head = `${task.title}\n${task.body}`;
        const at = find(head);
        if (at >= 0) tasks.push({ kind: 'task', id: task.id, proposed, snippet: snippet(head, at, needle.length) });
        for (const e of parseEntries(task.history)) {
          const hit = find(e.text);
          if (hit >= 0) dated.push({ kind: 'history', id: task.id, entry: e.n, when: `${e.date} ${e.time}`, proposed, snippet: snippet(e.text, hit, needle.length) });
        }
      }
    }
  }
  dated.sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''));
  return { hits: [...dated, ...tasks].slice(0, Math.min(Math.max(limit, 1), MAX_RESULTS)), truncated };
}
