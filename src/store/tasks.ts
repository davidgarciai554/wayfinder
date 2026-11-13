import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WayfinderError, type Warning } from './errors.ts';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.ts';
import { commitPaths } from './git.ts';
import {
  appendEntry,
  assertNoReservedHeading,
  creationEntry,
  formatEntry,
  HISTORY_WARN_AT,
  joinBody,
  MAX_HISTORY,
  parseEntries,
  splitBody,
  type HistoryFields,
} from './history.ts';
import { appendLogUnlocked, assertNoSecrets, MAX_LOG_ENTRY, taskLink } from './log.ts';
import { assertId, ID_RE, projectDir, safeJoin, slugify } from './paths.ts';
import { requireProject } from './project.ts';
// review.ts imports readTask from here too: both only call each other at run time, never while loading.
import { consumeReviewUnlocked } from './review.ts';
import { withLock, writeFileAtomic } from './sync.ts';
import { flatten } from './text.ts';
import { isoLocal, localDay, localTime, systemClock, type Clock } from './time.ts';
import {
  checkTransition,
  isStatus,
  PRIORITIES,
  ORIGINS,
  type Actor,
  type Origin,
  type Priority,
  type Status,
} from './transitions.ts';

export interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  origin: Origin;
  created: string;
  updated: string;
  plan: string;
  approvedVia?: 'web' | 'chat';
  riskAcknowledged?: boolean;
  /**
   * IDs of the tasks of the same project this one waits for (frontmatter depends_on). Planning
   * data only: it never blocks a transition nor authorises anything. Invalid values read as none.
   */
  dependsOn: string[];
  /**
   * WAY-14: free labels (frontmatter tags) such as web or docs. Read leniently: values outside
   * TAG_RE are ignored, so a hand-edited file never hides the task.
   */
  tags: string[];
  /** The description: the stored body above the history section. */
  body: string;
  /** Raw history section (see history.ts); null for tasks created before it existed. */
  history: string | null;
  /** Path relative to WAYFINDER_HOME, with forward slashes. */
  file: string;
  /** Raw frontmatter, kept so unknown keys survive rewrites. */
  data: Record<string, unknown>;
}

export interface Unreadable {
  file: string;
  reason: string;
}

export const MAX_TITLE = 200;
/** Lowercase letters, digits and hyphens: no spaces, Unicode or delimiters can reach the outputs. */
export const TAG_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
export const MAX_TAGS = 10;
export const MAX_BODY = 20_000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function tasksDir(home: string, slug: string): string {
  return safeJoin(projectDir(home, slug), 'tasks');
}

function toTask(rel: string, raw: string): Task | Unreadable {
  const parsed = parseFrontmatter(raw);
  if ('error' in parsed) return { file: rel, reason: parsed.error };
  const d = parsed.data;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : undefined);
  const id = str('id');
  if (!id || !ID_RE.test(id)) return { file: rel, reason: 'missing or invalid id' };
  if (!isStatus(d.status)) return { file: rel, reason: `unknown status: ${String(d.status)}` };
  const title = str('title');
  if (!title) return { file: rel, reason: 'missing title' };
  const priority = (PRIORITIES as readonly string[]).includes(String(d.priority)) ? (d.priority as Priority) : 'medium';
  const origin = (ORIGINS as readonly string[]).includes(String(d.origin)) ? (d.origin as Origin) : 'user';
  const { description, history } = splitBody(parsed.body);
  return {
    id,
    title,
    status: d.status,
    priority,
    origin,
    created: str('created') ?? '',
    updated: str('updated') ?? '',
    plan: str('plan') ?? '',
    approvedVia: d.approvedVia === 'web' || d.approvedVia === 'chat' ? d.approvedVia : undefined,
    riskAcknowledged: d.riskAcknowledged === true ? true : undefined,
    dependsOn: Array.isArray(d.depends_on) ? [...new Set(d.depends_on.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)))] : [],
    tags: Array.isArray(d.tags) ? [...new Set(d.tags.filter((x): x is string => typeof x === 'string' && TAG_RE.test(x)))].slice(0, MAX_TAGS) : [],
    body: description,
    history,
    file: rel,
    data: d,
  };
}

export function listTasks(home: string, slug: string): { tasks: Task[]; unreadable: Unreadable[] } {
  const dir = tasksDir(home, slug);
  const tasks: Task[] = [];
  const unreadable: Unreadable[] = [];
  if (!existsSync(dir)) return { tasks, unreadable };
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const rel = `projects/${slug}/tasks/${name}`;
    const result = toTask(rel, readFileSync(join(dir, name), 'utf8'));
    if ('reason' in result) unreadable.push(result);
    else tasks.push(result);
  }
  const num = (id: string) => Number(id.split('-')[1]);
  tasks.sort((a, b) => num(a.id) - num(b.id));
  return { tasks, unreadable };
}

export function readTask(home: string, slug: string, id: string): Task {
  assertId(id);
  const dir = tasksDir(home, slug);
  const name = existsSync(dir) ? readdirSync(dir).find((n) => n === `${id}.md` || n.startsWith(`${id}-`)) : undefined;
  if (!name) throw new WayfinderError('store.taskNotFound', { id });
  const rel = `projects/${slug}/tasks/${name}`;
  const result = toTask(rel, readFileSync(join(dir, name), 'utf8'));
  if ('reason' in result) throw new WayfinderError('store.taskUnreadable', { file: rel, reason: result.reason });
  if (result.id !== id) throw new WayfinderError('store.taskUnreadable', { file: rel, reason: `id mismatch (${result.id})` });
  return result;
}

export function validateTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean === '' || clean.length > MAX_TITLE || CONTROL_CHARS.test(title)) {
    throw new WayfinderError('store.invalidTitle', { max: MAX_TITLE });
  }
  assertNoSecrets(clean);
  return clean;
}

function validateBody(body: string): string {
  const clean = body.replace(/\r\n?/g, '\n');
  if (clean.length > MAX_BODY) throw new WayfinderError('store.bodyTooLong', { max: MAX_BODY });
  assertNoReservedHeading(clean);
  assertNoSecrets(clean);
  return clean;
}

/** Rejects instead of normalising: what is written is exactly what was asked for. */
export function validateTags(raw: string[]): string[] {
  if (raw.length > MAX_TAGS) throw new WayfinderError('store.tagTooMany', { max: MAX_TAGS });
  const seen = new Set<string>();
  for (const tag of raw) {
    if (typeof tag !== 'string' || !TAG_RE.test(tag)) throw new WayfinderError('store.invalidTag', { value: flatten(String(tag), 40) });
    if (seen.has(tag)) throw new WayfinderError('store.tagDuplicate', { tag });
    seen.add(tag);
  }
  assertNoSecrets([...seen].join('\n'));
  return [...seen];
}

/** An empty list removes the key, so the file looks as before tags existed. */
function setTags(task: Task, tags: string[]): void {
  task.tags = tags;
  if (tags.length) task.data.tags = tags;
  else delete task.data.tags;
}

function validatePriority(priority: string | undefined): Priority {
  if (priority === undefined) return 'medium';
  if (!(PRIORITIES as readonly string[]).includes(priority)) {
    throw new WayfinderError('store.invalidPriority', { value: priority, valid: PRIORITIES.join(', ') });
  }
  return priority as Priority;
}

/** Writes the task file keeping unknown frontmatter keys. Must run inside the lock. */
export function writeTaskUnlocked(home: string, task: Task): void {
  const data: Record<string, unknown> = { ...task.data };
  const known: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    origin: task.origin,
    created: task.created,
    updated: task.updated,
    plan: task.plan,
  };
  for (const [k, v] of Object.entries(known)) data[k] = v;
  if (task.approvedVia) data.approvedVia = task.approvedVia;
  if (task.riskAcknowledged) data.riskAcknowledged = true;
  writeFileAtomic(join(home, task.file), serializeFrontmatter(data, joinBody(task.body, task.history)));
}

function nextIdUnlocked(home: string, slug: string, prefix: string): string {
  const dir = tasksDir(home, slug);
  let max = 0;
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      const m = /^([A-Z]{2,6})-(\d+)(?:-|\.md$)/.exec(name);
      if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
    }
  }
  return `${prefix}-${max + 1}`;
}

export interface WriteResult {
  task: Task;
  warnings: Warning[];
}

/** The server decides status and origin from the channel: MCP → proposed/claude; web → todo/user. */
export function createTask(
  home: string,
  slug: string,
  input: { title: string; body?: string; priority?: string; tags?: string[] },
  actor: 'mcp' | 'web',
  clock: Clock = systemClock,
): WriteResult {
  const project = requireProject(home, slug);
  const title = validateTitle(input.title);
  const body = validateBody(input.body ?? '');
  const priority = validatePriority(input.priority);
  const tags = validateTags(input.tags ?? []);
  return withLock(home, () => {
    const id = nextIdUnlocked(home, slug, project.idPrefix);
    const date = clock();
    const now = isoLocal(date);
    const origin: Origin = actor === 'web' ? 'user' : 'claude';
    const task: Task = {
      id,
      title,
      status: actor === 'web' ? 'todo' : 'proposed',
      priority,
      origin,
      dependsOn: [],
      tags: [],
      created: now,
      updated: now,
      plan: '',
      body,
      // Every task has a history from the start (decision D7 of the history plan).
      history: `${creationEntry(localDay(date), localTime(date), origin)}
`,
      file: `projects/${slug}/tasks/${id}-${slugify(title)}.md`,
      data: {},
    };
    setTags(task, tags);
    safeJoin(home, task.file);
    writeTaskUnlocked(home, task);
    const warnings = commitPaths(home, [task.file], `wf: create ${id}`);
    return { task, warnings };
  });
}

function assertUnchanged(task: Task, expectedUpdated: string | undefined): void {
  if (expectedUpdated !== undefined && expectedUpdated !== task.updated) {
    throw new WayfinderError('store.conflict', { id: task.id });
  }
}

export const MAX_DEPENDENCIES = 20;

/** Only done frees a dependency; a missing task is shown but does not block (see WAY-15). */
export interface DependencyState {
  id: string;
  status: Status | null;
  title: string | null;
}

export function dependencyStates(task: Pick<Task, 'dependsOn'>, byId: ReadonlyMap<string, Task>): DependencyState[] {
  return task.dependsOn.map((id) => {
    const dep = byId.get(id);
    return { id, status: dep?.status ?? null, title: dep?.title ?? null };
  });
}

export function isBlocking(dep: DependencyState): boolean {
  return dep.status !== null && dep.status !== 'done';
}

function validateDependencyList(id: string, raw: string[]): string[] {
  if (raw.length > MAX_DEPENDENCIES) throw new WayfinderError('store.dependencyTooMany', { max: MAX_DEPENDENCIES });
  const seen = new Set<string>();
  for (const dep of raw) {
    assertId(dep);
    if (dep === id) throw new WayfinderError('store.dependencySelf', { id });
    if (seen.has(dep)) throw new WayfinderError('store.dependencyDuplicate', { dep });
    seen.add(dep);
  }
  return [...seen];
}

/** Every dependency exists in this project and none leads back to the task. Must run inside the lock. */
function assertDependencyGraph(home: string, slug: string, id: string, deps: string[]): void {
  const graph = new Map(listTasks(home, slug).tasks.map((t) => [t.id, t.dependsOn]));
  for (const dep of deps) if (!graph.has(dep)) throw new WayfinderError('store.dependencyNotFound', { dep });
  graph.set(id, deps);
  // Depth-first search from the task: reaching it again means the new edges close a cycle.
  const path: string[] = [];
  const done = new Set<string>();
  const visit = (node: string): string[] | null => {
    if (path.includes(node)) return [...path.slice(path.indexOf(node)), node];
    if (done.has(node)) return null;
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    done.add(node);
    return null;
  };
  const cycle = visit(id);
  if (cycle) throw new WayfinderError('store.dependencyCycle', { path: cycle.join(' → ') });
}

export function updateTask(
  home: string,
  slug: string,
  id: string,
  patch: { title?: string; priority?: string; plan?: string; body?: string; depends_on?: string[]; tags?: string[] },
  options: { expectedUpdated?: string; clock?: Clock; planExists?: (plan: string) => boolean } = {},
): WriteResult {
  const clock = options.clock ?? systemClock;
  const title = patch.title === undefined ? undefined : validateTitle(patch.title);
  const body = patch.body === undefined ? undefined : validateBody(patch.body);
  const priority = patch.priority === undefined ? undefined : validatePriority(patch.priority);
  const dependsOn = patch.depends_on === undefined ? undefined : validateDependencyList(id, patch.depends_on.map((d) => d.trim()));
  // Without tags the key in the file is left as it is, even values this version cannot read.
  const tags = patch.tags === undefined ? undefined : validateTags(patch.tags);
  if (patch.plan !== undefined && patch.plan !== '') {
    if (!options.planExists) throw new WayfinderError('store.planUnverifiable', {});
    if (!options.planExists(patch.plan)) throw new WayfinderError('store.planNotFound', { plan: patch.plan });
  }
  return withLock(home, () => {
    const task = readTask(home, slug, id);
    assertUnchanged(task, options.expectedUpdated);
    if (title !== undefined) task.title = title;
    if (body !== undefined) task.body = body;
    if (priority !== undefined) task.priority = priority;
    if (patch.plan !== undefined) task.plan = patch.plan;
    if (dependsOn !== undefined) {
      assertDependencyGraph(home, slug, id, dependsOn);
      task.dependsOn = dependsOn;
      // An empty list removes the key, so the file looks as before dependencies existed.
      if (dependsOn.length) task.data.depends_on = dependsOn;
      else delete task.data.depends_on;
    }
    if (tags !== undefined) setTags(task, tags);
    task.updated = isoLocal(clock());
    writeTaskUnlocked(home, task);
    const warnings = commitPaths(home, [task.file], `wf: update ${id}`);
    return { task, warnings };
  });
}

export interface StatusOptions {
  note?: string;
  trivial?: boolean;
  /** Checks that a plan path exists in the consumer repository (required for → in-progress). */
  planExists?: (plan: string) => boolean;
  expectedUpdated?: string;
  clock?: Clock;
}

/**
 * Where a done or discarded task goes when the person reopens it: back to todo if it is theirs
 * (origin user) or was approved (approvedVia), otherwise back to proposed, so reopening never
 * approves a proposal nobody approved. null for any other status.
 */
export function reopenTarget(task: Pick<Task, 'status' | 'origin' | 'approvedVia'>): Status | null {
  if (task.status === 'done') return 'todo';
  if (task.status === 'discarded') return task.origin === 'user' || task.approvedVia ? 'todo' : 'proposed';
  return null;
}

export function setStatus(
  home: string,
  slug: string,
  id: string,
  to: Status,
  actor: 'web' | 'mcp',
  options: StatusOptions = {},
): WriteResult {
  const clock = options.clock ?? systemClock;
  const note = options.note?.trim() || undefined;
  if (note) assertNoSecrets(note);
  return withLock(home, () => {
    const task = readTask(home, slug, id);
    assertUnchanged(task, options.expectedUpdated);
    const from = task.status;
    const rule = checkTransition(actor, from, to);
    if (rule.needsNote && !note) throw new WayfinderError('store.noteRequired', { from, to });
    const reopening = from === 'done' || from === 'discarded';
    if (reopening) {
      const target = reopenTarget(task);
      if (to !== target) throw new WayfinderError('store.invalidTransition', { from, to, valid: target ?? '—' });
      if (note && note.length > MAX_LOG_ENTRY) throw new WayfinderError('store.logEntryTooLong', { max: MAX_LOG_ENTRY });
    }
    const markers: string[] = [];
    if (rule.planRule) {
      if (options.trivial) {
        if (!note) throw new WayfinderError('store.trivialNeedsNote', {});
        markers.push('trivial: true');
      } else {
        if (!task.plan) throw new WayfinderError('store.planRequired', { id });
        if (!options.planExists) throw new WayfinderError('store.planUnverifiable', {});
        if (!options.planExists(task.plan)) throw new WayfinderError('store.planNotFound', { plan: task.plan });
      }
    }
    task.status = to;
    if (actor === 'web' && from === 'proposed' && to === 'todo') task.approvedVia = 'web';
    const date = clock();
    task.updated = isoLocal(date);
    // A reopened task keeps why in its own history, not only in the day's log.
    if (reopening && note) task.history = appendEntry(task.history, formatEntry(localDay(date), localTime(date), `status: ${from} -> ${to}\n\n${note}`));
    // Back to proposed: any earlier review is dropped, so a chat approval needs a new one.
    if (reopening && to === 'proposed') consumeReviewUnlocked(home, slug, id);
    writeTaskUnlocked(home, task);
    const paths = [task.file];
    if (note || markers.length > 0) {
      const lines = [`status: ${from} -> ${to}`, ...markers, ...(note ? [note] : []), '', taskLink(slug, id, task.title)];
      paths.push(appendLogUnlocked(home, slug, lines.join('\n'), id, () => date));
    }
    const warnings = commitPaths(home, paths, `wf: set-status ${id} ${from}->${to}`);
    // Starting a task whose dependencies are not done only warns: they are planning data.
    if (to === 'in-progress' && task.dependsOn.length) {
      const byId = new Map(listTasks(home, slug).tasks.map((t) => [t.id, t]));
      const open = dependencyStates(task, byId).filter(isBlocking);
      if (open.length) warnings.push({ key: 'store.dependenciesOpen', vars: { id, deps: open.map((d) => `${d.id} [${d.status}]`).join(', ') } });
    }
    return { task, warnings };
  });
}

export const MAX_HISTORY_FIELD = 1000;

/**
 * Records progress on a task: appends an entry to its history and a linked line to today's
 * log, under one lock and in one commit. Everything is validated before writing anything.
 */
export function logProgress(
  home: string,
  slug: string,
  id: string,
  entry: string,
  fields: HistoryFields = {},
  clock: Clock = systemClock,
): WriteResult & { entry: number; logFile: string } {
  requireProject(home, slug);
  assertId(id);
  const text = entry.replace(/\r\n?/g, '\n').trim();
  if (text === '') throw new WayfinderError('store.emptyLogEntry', {});
  if (text.length > MAX_LOG_ENTRY) throw new WayfinderError('store.logEntryTooLong', { max: MAX_LOG_ENTRY });
  for (const value of Object.values(fields)) {
    if (value !== undefined && value.length > MAX_HISTORY_FIELD) throw new WayfinderError('store.logEntryTooLong', { max: MAX_HISTORY_FIELD });
  }
  assertNoSecrets([text, ...Object.values(fields)].filter(Boolean).join('\n'));
  return withLock(home, () => {
    const task = readTask(home, slug, id);
    const date = clock();
    task.history = appendEntry(task.history, formatEntry(localDay(date), localTime(date), text, fields));
    const n = parseEntries(task.history).length;
    task.updated = isoLocal(date);
    const first = text.split('\n')[0];
    const summary = first.length > 200 ? `${first.slice(0, 199)}…` : first;
    writeTaskUnlocked(home, task);
    const logFile = appendLogUnlocked(home, slug, `${taskLink(slug, id, task.title, n)} — ${summary}`, id, () => date);
    const warnings = commitPaths(home, [task.file, logFile], `wf: log ${id}`);
    if (task.history.length > MAX_HISTORY * HISTORY_WARN_AT) warnings.push({ key: 'store.historyNearLimit', vars: { id, max: MAX_HISTORY } });
    return { task, warnings, entry: n, logFile };
  });
}
