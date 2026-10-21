import { existsSync, readFileSync } from 'node:fs';
import { WayfinderError, type Warning } from './errors.ts';
import { commitPaths } from './git.ts';
import { assertId, projectDir, safeJoin } from './paths.ts';
import { requireProject } from './project.ts';
import { findSecrets } from './secrets.ts';
import { withLock, writeFileAtomic } from './sync.ts';
import { localDay, localTime, systemClock, type Clock } from './time.ts';

export const MAX_LOG_ENTRY = 4000;

export function assertNoSecrets(text: string): void {
  const found = findSecrets(text);
  if (found.length > 0) throw new WayfinderError('store.secretRejected', { pattern: found.join(', ') });
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

export function hasLogFor(home: string, slug: string, day: string): boolean {
  return existsSync(safeJoin(projectDir(home, slug), 'log', `${day}.md`));
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
