import { WayfinderError } from './errors.ts';

/**
 * The task file keeps its history after a reserved heading. Everything above it is the
 * description; entries below it are only appended by Wayfinder (wf_log and task creation).
 * The heading is data, the same in every language.
 */
export const HISTORY_HEADING = '## Historial';
export const MAX_HISTORY = 100_000;
export const HISTORY_WARN_AT = 0.8;

const MARKER_RE = /^## Historial[ \t]*$/m;
const ENTRY_RE = /^### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})[ \t]*$/gm;
const CREATED_RE = /^Created \(origin: [a-z]+\)\.$/;

export interface HistoryEntry {
  /** 1 is the oldest entry. */
  n: number;
  date: string;
  time: string;
  /** Markdown as stored (lines that started with "#" are escaped as "\#"). */
  text: string;
}

export interface HistoryFields {
  decisions?: string;
  files?: string;
  next?: string;
  blockers?: string;
}

const FIELD_LABELS: ReadonlyArray<readonly [keyof HistoryFields, string]> = [
  ['decisions', 'Decisions'],
  ['files', 'Files'],
  ['next', 'Next'],
  ['blockers', 'Blockers'],
];

export function hasReservedHeading(description: string): boolean {
  return MARKER_RE.test(description);
}

export function assertNoReservedHeading(description: string): void {
  if (hasReservedHeading(description)) throw new WayfinderError('store.reservedHistoryHeading', { heading: HISTORY_HEADING });
}

/** Splits a stored body. `history` is null when the task predates the history section. */
export function splitBody(body: string): { description: string; history: string | null } {
  const match = MARKER_RE.exec(body);
  if (!match) return { description: body, history: null };
  const before = body.slice(0, match.index).replace(/\s+$/, '');
  const after = body.slice(match.index + match[0].length).replace(/^\n+/, '');
  return { description: before === '' ? '' : `${before}\n`, history: after };
}

export function joinBody(description: string, history: string | null): string {
  if (history === null) return description;
  const desc = description.replace(/\s+$/, '');
  const entries = history.replace(/\s+$/, '');
  return `${desc === '' ? '' : `${desc}\n\n`}${HISTORY_HEADING}\n${entries === '' ? '' : `\n${entries}\n`}`;
}

export function parseEntries(history: string | null): HistoryEntry[] {
  if (!history) return [];
  const heads = [...history.matchAll(ENTRY_RE)];
  return heads.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : history.length;
    return { n: i + 1, date: m[1], time: m[2], text: history.slice(start, end).trim() };
  });
}

export function isCreationEntry(entry: HistoryEntry): boolean {
  return CREATED_RE.test(entry.text);
}

/** Escapes every line that starts with "#" so an entry can never forge an entry or the marker. */
function escapeHeadings(text: string): string {
  return text.replace(/^(\s*)#/gm, '$1\\#');
}

export function formatEntry(date: string, time: string, text: string, fields: HistoryFields = {}): string {
  const lines = [`### ${date} ${time}`, '', escapeHeadings(text.replace(/\r\n?/g, '\n').trim())];
  const extra = FIELD_LABELS.filter(([key]) => fields[key]?.trim()).map(
    ([key, label]) => `- ${label}: ${escapeHeadings(fields[key]!.replace(/\s*\n\s*/g, ' ').trim())}`,
  );
  if (extra.length) lines.push('', ...extra);
  return lines.join('\n');
}

/** Returns the history with `entry` appended. Throws when the result exceeds MAX_HISTORY. */
export function appendEntry(history: string | null, entry: string): string {
  const current = (history ?? '').replace(/\s+$/, '');
  const next = `${current === '' ? '' : `${current}\n\n`}${entry}\n`;
  if (next.length > MAX_HISTORY) throw new WayfinderError('store.historyFull', { max: MAX_HISTORY });
  return next;
}

export function creationEntry(date: string, time: string, origin: string): string {
  return formatEntry(date, time, `Created (origin: ${origin}).`);
}

/** True when the task has an entry written that day other than the creation one. */
export function hasHistoryFor(history: string | null, day: string): boolean {
  return parseEntries(history).some((e) => e.date === day && !isCreationEntry(e));
}
