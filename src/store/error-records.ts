import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { WayfinderError, type Warning } from './errors.ts';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.ts';
import { commitPaths } from './git.ts';
import { appendEntry, formatEntry, HISTORY_WARN_AT, joinBody, MAX_HISTORY, splitBody } from './history.ts';
import { assertNoSecrets, MAX_LOG_ENTRY } from './log.ts';
import { assertErrorId, assertId, ERROR_ID_PREFIX, ERROR_ID_RE, ID_RE, projectDir, safeJoin, slugify } from './paths.ts';
import { requireProject } from './project.ts';
import { findSecrets } from './secrets.ts';
import { withLock, writeFileAtomic } from './sync.ts';
import { readTask, validateTitle } from './tasks.ts';
import { flatten } from './text.ts';
import { isoLocal, localDay, localTime, systemClock, type Clock } from './time.ts';

/**
 * Error records: one Markdown file per error under projects/<slug>/errors/, linked to a task.
 * The task file is never touched; its list of errors is computed when reading.
 */
/** discarded = closed without a fix (a false alarm or a failure that will not be fixed), with a note. */
export const ERROR_STATUSES = ['open', 'resolved', 'discarded'] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];
/**
 * A status this version does not know (written by a newer one) is read as it is, so the record
 * stays visible, but it cannot be changed here: see readForWrite.
 */
const STATUS_RE = /^[a-z][a-z-]{0,19}$/;

export function isErrorStatus(value: unknown): value is ErrorStatus {
  return typeof value === 'string' && (ERROR_STATUSES as readonly string[]).includes(value);
}
export const CAUSE_KINDS = ['hypothesis', 'confirmed'] as const;
export type CauseKind = (typeof CAUSE_KINDS)[number];
/**
 * What failed: the kinds AGENTS.md uses for error records plus the environment (ports,
 * permissions, configuration, dependencies). Optional; a missing or unknown value reads as
 * unclassified (null), so records written before kinds existed, or by a newer version, still load.
 */
export const ERROR_KINDS = ['build', 'test', 'analysis', 'runtime', 'behavior', 'environment'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export function isErrorKind(value: unknown): value is ErrorKind {
  return typeof value === 'string' && (ERROR_KINDS as readonly string[]).includes(value);
}

/** Body sections in order. Their headings are data, fixed in Spanish like "## Historial". */
export const ERROR_FIELDS = [
  ['context', 'Contexto'],
  ['reproduction', 'Reproducción'],
  ['output', 'Salida observada'],
  ['cause', 'Causa'],
  ['solution', 'Solución'],
  ['validation', 'Validación'],
  ['result', 'Resultado'],
] as const;
export type ErrorField = (typeof ERROR_FIELDS)[number][0];
export type ErrorFields = Partial<Record<ErrorField, string>>;

/** What was observed stays as written; corrections go in a note. */
const IMMUTABLE_FIELDS: readonly ErrorField[] = ['context', 'reproduction', 'output'];

export const MAX_FIELD = 4000;
export const MAX_OUTPUT = 8000;
export const MAX_FIELDS_TOTAL = 20_000;
export const MAX_FILES = 20;
export const MAX_FILE_PATH = 200;
const MAX_DUPLICATES = 3;
const MIN_DUPLICATE_NEEDLE = 8;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export interface ErrorRecord {
  id: string;
  title: string;
  /** One of ERROR_STATUSES, or an unknown status from a newer version (shown, never written). */
  status: ErrorStatus | (string & {});
  /** ID of the task the error belongs to. */
  task: string;
  causeKind: CauseKind;
  /** null = unclassified (no kind, or one this version does not know). */
  kind: ErrorKind | null;
  files: string[];
  created: string;
  updated: string;
  /** Field values as stored (lines that started with "#" are escaped as "\#"); '' when empty. */
  fields: Record<ErrorField, string>;
  history: string | null;
  /** Path relative to WAYFINDER_HOME, with forward slashes. */
  file: string;
  data: Record<string, unknown>;
}

export interface ErrorUnreadable {
  file: string;
  reason: string;
}

export interface ErrorWriteResult {
  error: ErrorRecord;
  warnings: Warning[];
}

function errorsDir(home: string, slug: string): string {
  return safeJoin(projectDir(home, slug), 'errors');
}

const LABEL_TO_FIELD = new Map<string, ErrorField>(ERROR_FIELDS.map(([key, label]) => [label, key]));

function emptyFields(): Record<ErrorField, string> {
  return Object.fromEntries(ERROR_FIELDS.map(([key]) => [key, ''])) as Record<ErrorField, string>;
}

function parseSections(description: string): Record<ErrorField, string> {
  const fields = emptyFields();
  const parts: Partial<Record<ErrorField, string[]>> = {};
  // Text before the first heading (only possible after a manual edit) is kept with the context.
  let current: ErrorField = 'context';
  for (const line of description.split('\n')) {
    const heading = /^## (.+?)[ \t]*$/.exec(line);
    const field = heading ? LABEL_TO_FIELD.get(heading[1]) : undefined;
    if (field) {
      current = field;
      continue;
    }
    (parts[current] ??= []).push(line);
  }
  for (const [key] of ERROR_FIELDS) fields[key] = (parts[key] ?? []).join('\n').trim();
  return fields;
}

function serializeSections(fields: Record<ErrorField, string>): string {
  return ERROR_FIELDS.filter(([key]) => fields[key] !== '')
    .map(([key, label]) => `## ${label}\n\n${fields[key]}\n`)
    .join('\n');
}

function toRecord(rel: string, raw: string): ErrorRecord | ErrorUnreadable {
  const parsed = parseFrontmatter(raw);
  if ('error' in parsed) return { file: rel, reason: parsed.error };
  const d = parsed.data;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : undefined);
  const id = str('id');
  if (!id || !ERROR_ID_RE.test(id)) return { file: rel, reason: 'missing or invalid id' };
  const status = str('status');
  if (!status || !STATUS_RE.test(status)) return { file: rel, reason: `unknown status: ${String(d.status)}` };
  const title = str('title');
  if (!title) return { file: rel, reason: 'missing title' };
  const task = str('task');
  if (!task || !ID_RE.test(task)) return { file: rel, reason: 'missing or invalid task' };
  const causeKind = d.cause_kind === 'confirmed' ? 'confirmed' : 'hypothesis';
  const files = Array.isArray(d.files) ? d.files.filter((f): f is string => typeof f === 'string') : [];
  const { description, history } = splitBody(parsed.body);
  return {
    id,
    title,
    status,
    task,
    causeKind,
    kind: isErrorKind(d.kind) ? d.kind : null,
    files,
    created: str('created') ?? '',
    updated: str('updated') ?? '',
    fields: parseSections(description),
    history,
    file: rel,
    data: d,
  };
}

export function listErrors(home: string, slug: string): { errors: ErrorRecord[]; unreadable: ErrorUnreadable[] } {
  const dir = errorsDir(home, slug);
  const errors: ErrorRecord[] = [];
  const unreadable: ErrorUnreadable[] = [];
  if (!existsSync(dir)) return { errors, unreadable };
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const rel = `projects/${slug}/errors/${name}`;
    const result = toRecord(rel, readFileSync(join(dir, name), 'utf8'));
    if ('reason' in result) unreadable.push(result);
    else errors.push(result);
  }
  const num = (id: string) => Number(id.split('-')[1]);
  errors.sort((a, b) => num(a.id) - num(b.id));
  return { errors, unreadable };
}

export function readError(home: string, slug: string, id: string): ErrorRecord {
  assertErrorId(id);
  const dir = errorsDir(home, slug);
  const name = existsSync(dir) ? readdirSync(dir).find((n) => n === `${id}.md` || n.startsWith(`${id}-`)) : undefined;
  if (!name) throw new WayfinderError('store.errorNotFound', { id });
  const rel = `projects/${slug}/errors/${name}`;
  const result = toRecord(rel, readFileSync(join(dir, name), 'utf8'));
  if ('reason' in result) throw new WayfinderError('store.errorUnreadable', { file: rel, reason: result.reason });
  if (result.id !== id) throw new WayfinderError('store.errorUnreadable', { file: rel, reason: `id mismatch (${result.id})` });
  return result;
}

/** The errors of a task, computed when reading: the task file holds no list. */
export function errorsForTask(home: string, slug: string, taskId: string): ErrorRecord[] {
  return listErrors(home, slug).errors.filter((e) => e.task === taskId);
}

/**
 * Adds one backslash before a "#" at line start, after any backslashes already there, so no
 * field can forge a heading and `unescapeField` restores the exact text (also "\#" lines).
 */
function escapeField(text: string): string {
  return text.replace(/^(\s*)(\\*)#/gm, '$1$2\\#');
}

/** Inverse of escapeField, for showing a field as plain text. */
export function unescapeField(text: string): string {
  return text.replace(/^(\s*)\\(\\*#)/gm, '$1$2');
}

function validateField(key: ErrorField, value: string): string {
  const clean = value.replace(/\r\n?/g, '\n').trim();
  const max = key === 'output' ? MAX_OUTPUT : MAX_FIELD;
  if (clean.length > max) throw new WayfinderError('store.errorFieldTooLong', { field: key, max });
  assertNoSecrets(clean);
  return escapeField(clean);
}

function validateFields(fields: ErrorFields): ErrorFields {
  const out: ErrorFields = {};
  for (const [key] of ERROR_FIELDS) {
    const value = fields[key];
    if (value !== undefined) out[key] = validateField(key, value);
  }
  return out;
}

function validateFiles(files: string[]): string[] {
  if (files.length > MAX_FILES) throw new WayfinderError('store.errorFilesTooMany', { max: MAX_FILES });
  return files.map((raw) => {
    assertNoSecrets(raw);
    const path = raw.trim().replace(/\\/g, '/').replace(/^(?:\.\/)+/, '');
    const invalid =
      path === '' ||
      path.length > MAX_FILE_PATH ||
      CONTROL_CHARS.test(path) ||
      path.startsWith('/') ||
      /^[A-Za-z]:/.test(path) ||
      path.split('/').includes('..');
    if (invalid) throw new WayfinderError('store.errorFileInvalid', { value: flatten(raw, 80), max: MAX_FILE_PATH });
    return path;
  });
}

function validateCauseKind(value: string | undefined): CauseKind | undefined {
  if (value === undefined) return undefined;
  if (!(CAUSE_KINDS as readonly string[]).includes(value)) {
    throw new WayfinderError('store.invalidCauseKind', { value, valid: CAUSE_KINDS.join(', ') });
  }
  return value as CauseKind;
}

function validateKind(value: string | undefined): ErrorKind | undefined {
  if (value === undefined) return undefined;
  if (!isErrorKind(value)) throw new WayfinderError('store.invalidKind', { value: flatten(value, 40), valid: ERROR_KINDS.join(', ') });
  return value;
}

function validateNote(note: string | undefined): string | undefined {
  const clean = note?.replace(/\r\n?/g, '\n').trim();
  if (!clean) return undefined;
  if (clean.length > MAX_LOG_ENTRY) throw new WayfinderError('store.logEntryTooLong', { max: MAX_LOG_ENTRY });
  assertNoSecrets(clean);
  return clean;
}

function assertTotal(fields: Record<ErrorField, string>): void {
  const total = Object.values(fields).reduce((sum, v) => sum + v.length, 0);
  if (total > MAX_FIELDS_TOTAL) throw new WayfinderError('store.errorFieldsTooLong', { max: MAX_FIELDS_TOTAL });
}

function nextErrorIdUnlocked(home: string, slug: string): string {
  const dir = errorsDir(home, slug);
  let max = 0;
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      const m = /^ERR-(\d+)(?:-|\.md$)/.exec(name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `${ERROR_ID_PREFIX}-${max + 1}`;
}

function serializeRecord(record: ErrorRecord): string {
  const data: Record<string, unknown> = { ...record.data };
  const known: Record<string, unknown> = {
    id: record.id,
    title: record.title,
    status: record.status,
    task: record.task,
    cause_kind: record.causeKind,
    files: record.files,
    created: record.created,
    updated: record.updated,
  };
  for (const [k, v] of Object.entries(known)) data[k] = v;
  // An unknown kind already in the file (a newer version) is kept as it is until a valid one replaces it.
  if (record.kind !== null) data.kind = record.kind;
  return serializeFrontmatter(data, joinBody(serializeSections(record.fields), record.history));
}

/**
 * Writes and commits one error file. The whole document is scanned before writing. commitPaths
 * scans the same bytes again; if it ever reports a secret, the write is undone (a new file is
 * removed, an existing one restored) so no uncommitted secret stays readable. Must run inside the lock.
 */
function saveUnlocked(home: string, record: ErrorRecord, previous: string | null, message: string): Warning[] {
  const content = serializeRecord(record);
  const found = findSecrets(content);
  if (found.length > 0) throw new WayfinderError('store.secretRejected', { pattern: found.join(', ') });
  const path = safeJoin(home, record.file);
  writeFileAtomic(path, content);
  const warnings = commitPaths(home, [record.file], message);
  const leak = warnings.find((w) => w.key === 'git.secretNotCommitted');
  if (leak) {
    if (previous === null) rmSync(path, { force: true });
    else writeFileAtomic(path, previous);
    throw new WayfinderError('store.secretRejected', { pattern: String(leak.vars.pattern ?? '') });
  }
  if ((record.history?.length ?? 0) > MAX_HISTORY * HISTORY_WARN_AT) {
    warnings.push({ key: 'store.historyNearLimit', vars: { id: record.id, max: MAX_HISTORY } });
  }
  return warnings;
}

function addEntry(record: ErrorRecord, date: Date, text: string): void {
  try {
    record.history = appendEntry(record.history, formatEntry(localDay(date), localTime(date), text));
  } catch (error) {
    if (error instanceof WayfinderError && error.key === 'store.historyFull') {
      throw new WayfinderError('store.errorHistoryFull', { id: record.id, max: MAX_HISTORY });
    }
    throw error;
  }
}

/** Open errors whose title or output contain the new title or the first line of the new output. */
function findDuplicates(errors: ErrorRecord[], title: string, output: string | undefined): ErrorRecord[] {
  const needles = [title, (output ?? '').split('\n')[0] ?? '']
    .map((n) => n.trim().toLowerCase())
    .filter((n) => n.length >= MIN_DUPLICATE_NEEDLE);
  if (needles.length === 0) return [];
  return errors
    .filter((e) => e.status === 'open')
    .filter((e) => {
      const hay = `${e.title}\n${e.fields.output}`.toLowerCase();
      return needles.some((n) => hay.includes(n));
    })
    .slice(0, MAX_DUPLICATES);
}

export interface NewError extends ErrorFields {
  title: string;
  task: string;
  causeKind?: string;
  kind?: string;
  files?: string[];
}

export function createError(
  home: string,
  slug: string,
  input: NewError,
  clock: Clock = systemClock,
): ErrorWriteResult & { duplicates: ErrorRecord[] } {
  requireProject(home, slug);
  if (!input.task?.trim()) throw new WayfinderError('store.errorTaskRequired', {});
  assertId(input.task);
  const title = validateTitle(input.title);
  const values = validateFields(input);
  if (!values.context) throw new WayfinderError('store.errorContextRequired', {});
  const causeKind = validateCauseKind(input.causeKind) ?? 'hypothesis';
  const kind = validateKind(input.kind) ?? null;
  const files = validateFiles(input.files ?? []);
  const fields = { ...emptyFields(), ...values };
  assertTotal(fields);
  return withLock(home, () => {
    readTask(home, slug, input.task);
    const duplicates = findDuplicates(listErrors(home, slug).errors, title, input.output);
    const id = nextErrorIdUnlocked(home, slug);
    const date = clock();
    const now = isoLocal(date);
    const record: ErrorRecord = {
      id,
      title,
      status: 'open',
      task: input.task,
      causeKind,
      kind,
      files,
      created: now,
      updated: now,
      fields,
      history: null,
      file: `projects/${slug}/errors/${id}-${slugify(title)}.md`,
      data: {},
    };
    addEntry(record, date, `Created (task: ${input.task}).`);
    const warnings = saveUnlocked(home, record, null, `wf: error create ${id}`);
    return { error: record, warnings, duplicates };
  });
}

export interface ErrorPatch extends ErrorFields {
  causeKind?: string;
  kind?: string;
  files?: string[];
  /** Rejected: kept here so callers get a clear error instead of a silent no-op. */
  title?: string;
  /**
   * WAY-11: moves the error to another task of the project; only in updateError and with a note.
   * Still one task per error: linking it to several would change errorsForTask and every reader.
   */
  task?: string;
}

function assertEditable(patch: ErrorPatch): void {
  for (const key of ['title', ...IMMUTABLE_FIELDS] as const) {
    if (patch[key] !== undefined) throw new WayfinderError('store.errorFieldImmutable', { field: key });
  }
}

/** Applies editable fields; returns the names of those that changed. */
function applyPatch(
  record: ErrorRecord,
  values: ErrorFields,
  causeKind: CauseKind | undefined,
  kind: ErrorKind | undefined,
  files: string[] | undefined,
): string[] {
  const changed: string[] = [];
  for (const [key] of ERROR_FIELDS) {
    const value = values[key];
    if (value !== undefined && value !== record.fields[key]) {
      record.fields[key] = value;
      changed.push(key);
    }
  }
  if (causeKind !== undefined && causeKind !== record.causeKind) {
    record.causeKind = causeKind;
    changed.push('cause_kind');
  }
  if (kind !== undefined && kind !== record.kind) {
    record.kind = kind;
    changed.push('kind');
  }
  if (files !== undefined && files.join('\n') !== record.files.join('\n')) {
    record.files = files;
    changed.push('files');
  }
  assertTotal(record.fields);
  return changed;
}

function entryText(head: string, changed: string[], note: string | undefined): string {
  const lines = [changed.length ? `${head} Fields: ${changed.join(', ')}.` : head];
  if (note) lines.push(note);
  return lines.join('\n');
}

function prepare(patch: ErrorPatch, note: string | undefined) {
  assertEditable(patch);
  if (patch.task !== undefined) assertId(patch.task);
  return {
    task: patch.task,
    values: validateFields(patch),
    causeKind: validateCauseKind(patch.causeKind),
    kind: validateKind(patch.kind),
    files: patch.files === undefined ? undefined : validateFiles(patch.files),
    note: validateNote(note),
  };
}

function readForWrite(home: string, slug: string, id: string): { record: ErrorRecord; previous: string } {
  const record = readError(home, slug, id);
  if (!isErrorStatus(record.status)) throw new WayfinderError('store.errorUnknownStatus', { id, status: record.status });
  return { record, previous: readFileSync(safeJoin(home, record.file), 'utf8') };
}

/** Edits the editable fields, or reopens a resolved or discarded error (`reopen` needs a note with the reason). */
export function updateError(
  home: string,
  slug: string,
  id: string,
  patch: ErrorPatch,
  options: { note?: string; reopen?: boolean; clock?: Clock } = {},
): ErrorWriteResult {
  requireProject(home, slug);
  assertErrorId(id);
  const clock = options.clock ?? systemClock;
  const p = prepare(patch, options.note);
  if (options.reopen && !p.note) throw new WayfinderError('store.errorReopenNeedsNote', {});
  // The task was fixed to keep the evidence of where the error was seen: moving it needs the reason.
  if (p.task !== undefined && !p.note) throw new WayfinderError('store.errorTaskNeedsNote', {});
  return withLock(home, () => {
    const { record, previous } = readForWrite(home, slug, id);
    if (options.reopen && record.status !== 'resolved' && record.status !== 'discarded') throw new WayfinderError('store.errorNotResolved', { id });
    const from = record.task;
    const moved = p.task !== undefined && p.task !== from;
    // Same check as createError: the new task must exist in this project, read inside the lock.
    if (moved) readTask(home, slug, p.task!);
    const changed = applyPatch(record, p.values, p.causeKind, p.kind, p.files);
    if (changed.length === 0 && !moved && !options.reopen) throw new WayfinderError('store.errorNothingToUpdate', { id });
    if (moved) record.task = p.task!;
    // A resolved error keeps its evidence: emptying the solution or validation needs a reopen first.
    if (!options.reopen && record.status === 'resolved' && (!record.fields.solution || !record.fields.validation)) {
      throw new WayfinderError('store.errorResolvedKeepsEvidence', { id });
    }
    const date = clock();
    if (options.reopen) record.status = 'open';
    record.updated = isoLocal(date);
    const head = `${options.reopen ? 'Reopened.' : 'Updated.'}${moved ? ` Task: ${from} -> ${record.task}.` : ''}`;
    addEntry(record, date, entryText(head, changed, p.note));
    const warnings = saveUnlocked(home, record, previous, `wf: error ${options.reopen ? 'reopen' : 'update'} ${id}`);
    return { error: record, warnings };
  });
}

/** Resolves an error. Solution and validation must exist, in the error or in this call. */
export function resolveError(
  home: string,
  slug: string,
  id: string,
  patch: ErrorPatch = {},
  options: { note?: string; clock?: Clock } = {},
): ErrorWriteResult & { written: boolean } {
  requireProject(home, slug);
  assertErrorId(id);
  const clock = options.clock ?? systemClock;
  if (patch.task !== undefined) throw new WayfinderError('store.errorTaskOnlyInUpdate', {});
  const p = prepare(patch, options.note);
  return withLock(home, () => {
    const { record, previous } = readForWrite(home, slug, id);
    if (record.status === 'resolved') {
      return { error: record, warnings: [{ key: 'store.errorAlreadyResolved', vars: { id } }], written: false };
    }
    const changed = applyPatch(record, p.values, p.causeKind, p.kind, p.files);
    if (!record.fields.solution || !record.fields.validation) throw new WayfinderError('store.errorResolveNeedsSolution', { id });
    const date = clock();
    record.status = 'resolved';
    record.updated = isoLocal(date);
    addEntry(record, date, entryText('Resolved.', changed, p.note));
    const warnings = saveUnlocked(home, record, previous, `wf: error resolve ${id}`);
    return { error: record, warnings, written: true };
  });
}

/**
 * Closes an error without a fix: a false alarm or a failure that will not be fixed. The reason is
 * required and stays in the error's notes; the web lists it under «Descartados».
 */
export function discardError(
  home: string,
  slug: string,
  id: string,
  note: string,
  clock: Clock = systemClock,
): ErrorWriteResult & { written: boolean } {
  requireProject(home, slug);
  assertErrorId(id);
  const text = validateNote(note);
  if (!text) throw new WayfinderError('store.errorDiscardNeedsNote', {});
  return withLock(home, () => {
    const { record, previous } = readForWrite(home, slug, id);
    if (record.status === 'discarded') {
      return { error: record, warnings: [{ key: 'store.errorAlreadyDiscarded', vars: { id } }], written: false };
    }
    const date = clock();
    record.status = 'discarded';
    record.updated = isoLocal(date);
    addEntry(record, date, `Discarded.\n${text}`);
    const warnings = saveUnlocked(home, record, previous, `wf: error discard ${id}`);
    return { error: record, warnings, written: true };
  });
}

/** Adds a dated note: a recurrence, new context or a correction of an immutable field. */
export function noteError(home: string, slug: string, id: string, note: string, clock: Clock = systemClock): ErrorWriteResult {
  requireProject(home, slug);
  assertErrorId(id);
  const text = validateNote(note);
  if (!text) throw new WayfinderError('store.emptyLogEntry', {});
  return withLock(home, () => {
    const { record, previous } = readForWrite(home, slug, id);
    const date = clock();
    record.updated = isoLocal(date);
    addEntry(record, date, text);
    const warnings = saveUnlocked(home, record, previous, `wf: error note ${id}`);
    return { error: record, warnings };
  });
}
