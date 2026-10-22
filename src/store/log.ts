import { existsSync, readFileSync } from 'node:fs';
import { WayfinderError, type Warning } from './errors.ts';
import { commitPaths } from './git.ts';
import { assertId, assertSlug, projectDir, safeJoin } from './paths.ts';
import { requireProject } from './project.ts';
import { findSecrets } from './secrets.ts';
import { withLock, writeFileAtomic } from './sync.ts';
import { localDay, localTime, systemClock, type Clock } from './time.ts';

export const MAX_LOG_ENTRY = 4000;

export function assertNoSecrets(text: string): void {
  const found = findSecrets(text);
  if (found.length > 0) throw new WayfinderError('store.secretRejected', { pattern: found.join(', ') });
}

/**
 * Markdown link from the log to a task (or to one of its history entries). Built by code from
 * validated values, never from text written by Claude.
 */
export function taskLink(slug: string, id: string, title: string, entry?: number): string {
  assertSlug(slug);
  assertId(id);
  const label = `${id} · ${title.length > 80 ? `${title.slice(0, 79)}…` : title}`.replace(/[\\[\]]/g, '\\$&');
  return `[${label}](#/${slug}/task/${id}${entry ? `/${entry}` : ''})`;
}

/** Appends to log/YYYY-MM-DD.md. Must run inside the store lock. Returns the path relative to home. */
export function appendLogUnlocked(home: string, slug: string, entry: string, taskId: string | undefined, clock: Clock): string {
  const text = entry.replace(/\r\n?/g, '\n').trim();
  if (text === '') throw new WayfinderError('store.emptyLogEntry', {});
  if (text.length > MAX_LOG_ENTRY) throw new WayfinderError('store.logEntryTooLong', { max: MAX_LOG_ENTRY });
  assertNoSecrets(text);
  if (taskId !== undefined) assertId(taskId);
  const now = clock();
  const day = localDay(now);
  const file = safeJoin(projectDir(home, slug), 'log', `${day}.md`);
  const previous = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n?/g, '\n') : `# ${day}\n`;
  const heading = `## ${localTime(now)}${taskId ? ` · ${taskId}` : ''}`;
  writeFileAtomic(file, `${previous.trimEnd()}\n\n${heading}\n\n${text}\n`);
  return `projects/${slug}/log/${day}.md`;
}

/**
 * True when the day has at least one entry written with wf_log. Status changes also leave
 * automatic records ("status: a -> b" plus markers) in the day file; they are not a summary of
 * the work, so they do not count. Limit: a wf_log entry that itself starts with "status: x -> y"
 * would be taken for an automatic one.
 */
export function hasLogFor(home: string, slug: string, day: string): boolean {
  const file = safeJoin(projectDir(home, slug), 'log', `${day}.md`);
  if (!existsSync(file)) return false;
  const entries = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split(/^## .*$/m).slice(1);
  return entries.some((entry) => !/^\s*status: \S+ -> \S+$/m.test(entry.trimStart().split('\n')[0] ?? ''));
}

/**
 * True when the day has a free entry: one written with wf_log without a task (minor work).
 * Entries about a task carry " · ID" in their heading; automatic records start with "status:".
 */
export function hasFreeLogFor(home: string, slug: string, day: string): boolean {
  const file = safeJoin(projectDir(home, slug), 'log', `${day}.md`);
  if (!existsSync(file)) return false;
  const text = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const heads = [...text.matchAll(/^## (.*)$/gm)];
  return heads.some((head, i) => {
    if (head[1].includes(' · ')) return false;
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    const first = text.slice((head.index ?? 0) + head[0].length, end).trim().split('\n')[0] ?? '';
    return first !== '' && !/^status: \S+ -> \S+$/.test(first);
  });
}

export function appendLog(
  home: string,
  slug: string,
  entry: string,
  options: { taskId?: string; clock?: Clock } = {},
): { file: string; warnings: Warning[] } {
  requireProject(home, slug);
  const clock = options.clock ?? systemClock;
  return withLock(home, () => {
    const file = appendLogUnlocked(home, slug, entry, options.taskId, clock);
    const warnings = commitPaths(home, [file], `wf: log${options.taskId ? ` ${options.taskId}` : ''}`);
    return { file, warnings };
  });
}
