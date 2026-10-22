import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveLang, t, type Lang } from './i18n/index.ts';
import { isInitialized } from './store/init.ts';
import { hasHistoryFor, isCreationEntry, parseEntries } from './store/history.ts';
import { hasFreeLogFor } from './store/log.ts';
import { extractOrders, recordOrders } from './store/mentions.ts';
import { getHome, isWithin } from './store/paths.ts';
import { matchProject, findRepoRoot } from './store/resolve.ts';
import { listTasks, type Task } from './store/tasks.ts';
import { flatten, neutralize } from './store/text.ts';
import { localDay } from './store/time.ts';

export const HOOK_EVENTS = ['session-start', 'prompt', 'pre-tool', 'stop'] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HookIo {
  stdin: () => string;
  out: (text: string) => void;
}

const MAX_CONTEXT = 4000;
const MAX_TITLE = 80;
const MAX_HISTORY_BLOCK = 1200;
const HISTORY_TASKS = 2;

/** userConfig defaults declared by the plugin itself (CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json). */
function manifestDefaults(env: NodeJS.ProcessEnv): { home?: string; language?: string } {
  if (!env.CLAUDE_PLUGIN_ROOT) return {};
  try {
    const manifest = JSON.parse(readFileSync(join(env.CLAUDE_PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    const value = (key: string) => {
      const v = manifest?.userConfig?.[key]?.default;
      return typeof v === 'string' ? v : undefined;
    };
    return { home: value('home'), language: value('language') };
  } catch {
    return {};
  }
}

/**
 * Plugin options reach command hooks as CLAUDE_PLUGIN_OPTION_<KEY> only once the person saved them;
 * unsaved options are neither exported nor substituted in hook args (verified in a real session),
 * so the manifest defaults are the last fallback, matching what .mcp.json receives.
 * WAYFINDER_* wins when set explicitly (tests, manual use). Empty or unexpanded values are ignored.
 */
export function hookEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const pick = (...values: Array<string | undefined>) => values.find((v) => v !== undefined && v.trim() !== '' && !v.includes('${'));
  const defaults = manifestDefaults(env);
  return {
    ...env,
    WAYFINDER_HOME: pick(env.WAYFINDER_HOME, env.CLAUDE_PLUGIN_OPTION_HOME, defaults.home),
    WAYFINDER_LANG: pick(env.WAYFINDER_LANG, env.CLAUDE_PLUGIN_OPTION_LANGUAGE, defaults.language),
  };
}


function projectFor(home: string, input: Record<string, unknown>, env: NodeJS.ProcessEnv) {
  const dir = env.CLAUDE_PROJECT_DIR?.trim() || (typeof input.cwd === 'string' ? input.cwd : '');
  if (!dir) return null;
  const root = findRepoRoot(dir) ?? resolve(dir);
  return matchProject(home, root);
}

/** Metadata plus the recent history of in-progress tasks; never descriptions: they may carry text from the web (prompt injection). */
export function sessionContext(lang: Lang, slug: string, tasks: Task[]): string {
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(lang, key, vars);
  const row = (x: Task) => `- ${x.id} [${x.status}] (${x.priority}) ${flatten(x.title, MAX_TITLE)}`;
  const active = tasks.filter((x) => x.status === 'in-progress' || x.status === 'todo');
  const proposed = tasks.filter((x) => x.status === 'proposed');
  const lines = [tr('hook.session.header', { slug }), `language: ${lang}`, tr('hook.session.skill')];
  lines.push('', tr('hook.session.active'), ...(active.length ? active.map(row) : [tr('hook.session.none')]));
  if (proposed.length) lines.push('', tr('hook.session.proposed'), ...proposed.map(row));
  let text = lines.join('\n');
  if (text.length > MAX_CONTEXT) {
    const note = `\n${tr('hook.session.truncated')}`;
    text = `${text.slice(0, MAX_CONTEXT - note.length)}${note}`;
  }
  // Recent history goes last and only while it fits: it never pushes the metadata out.
  const history = historyLines(tasks);
  if (history.length) {
    let block = `\n\n${tr('hook.session.history')}`;
    for (const row of history) {
      const next = `${block}\n${row}`;
      if (next.length > MAX_HISTORY_BLOCK || text.length + next.length > MAX_CONTEXT) break;
      block = next;
    }
    if (block.includes('\n- ')) text += block;
  }
  return text;
}

/**
 * The latest progress of up to two in-progress tasks, one line per entry. Entries are written
 * only through wf_log (the description cannot hold the history heading), but Claude may have
 * summarised untrusted content, so everything is flattened, defused and labelled as data.
 */
function historyLines(tasks: Task[]): string[] {
  const field = (text: string, label: string) => new RegExp(`^- ${label}: (.*)$`, 'm').exec(text)?.[1] ?? '';
  const line = (text: string, max: number) => flatten(neutralize(text.split('\n')[0] ?? ''), max);
  return tasks
    .filter((x) => x.status === 'in-progress')
    .map((task) => ({ task, entries: parseEntries(task.history).filter((e) => !isCreationEntry(e)) }))
    .filter((x) => x.entries.length > 0)
    .map((x) => ({ ...x, last: `${x.entries.at(-1)!.date} ${x.entries.at(-1)!.time}` }))
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, HISTORY_TASKS)
    .flatMap(({ task, entries }) => {
      const latest = entries.at(-1)!;
      const extra = [['next', field(latest.text, 'Next')], ['blockers', field(latest.text, 'Blockers')]]
        .filter(([, v]) => v)
        .map(([k, v]) => ` | ${k}: ${flatten(neutralize(v), 150)}`)
        .join('');
      const earlier = entries.slice(-3, -1).reverse().map((e) => `  ${e.date} ${e.time}: ${line(e.text, 100)}`);
      return [`- ${task.id} ${latest.date} ${latest.time}: ${line(latest.text, 200)}${extra}`, ...earlier];
    });
}

function denyReason(home: string, input: Record<string, unknown>): string | null {
  const tool = String(input.tool_name ?? '');
  const toolInput = (input.tool_input ?? {}) as Record<string, unknown>;
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    const target = toolInput.file_path ?? toolInput.notebook_path;
    if (typeof target === 'string' && target && isWithin(home, resolve(String(input.cwd ?? '.'), target))) return target;
    return null;
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cwd = typeof input.cwd === 'string' ? input.cwd : '';
    if (cwd && isWithin(home, cwd)) return cwd;
    const command = typeof toolInput.command === 'string' ? toolInput.command : '';
    const norm = (s: string) => s.replaceAll('\\', '/').toLowerCase();
    const cmd = norm(command);
    const homeNorm = norm(resolve(home)).replace(/\/+$/, '');
    const msysHome = homeNorm.replace(/^([a-z]):/, '/$1'); // Git Bash spelling: /c/Users/...
    // Heuristic (documented as best effort): variables, relative paths or aliases can evade it.
    if (cmd.includes(homeNorm) || cmd.includes(msysHome) || cmd.includes('wayfinder_home') || /(^|[\s/~"'`=:(])\.wayfinder(?=$|[\s/"'`);])/.test(cmd)) return command;
    return null;
  }
  return null;
}

/** Hooks never break the session: any failure exits 0 without output. */
export function runHook(event: string, io: HookIo, baseEnv: NodeJS.ProcessEnv = process.env, now: () => number = Date.now): number {
  try {
    const env = hookEnv(baseEnv);
    const home = getHome(env);
    const lang = resolveLang(env);
    let input: Record<string, unknown> = {};
    try {
      const raw = io.stdin();
      input = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      input = {};
    }

    if (event === 'pre-tool') {
      const target = denyReason(home, input);
      if (target !== null) {
        io.out(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: t(lang, 'hook.preTool.denied'),
          },
        }));
      }
      return 0;
    }

    // First run after installing the plugin: the MCP refuses an uninitialised folder, so say how
    // to create it (to the person and to Claude) instead of failing silently.
    if (event === 'session-start' && !isInitialized(home)) {
      const root = env.CLAUDE_PLUGIN_ROOT?.trim();
      const command = root ? `node "${join(root, 'dist', 'wayfinder.mjs')}" init` : 'wayfinder init';
      const message = t(lang, 'hook.session.notInitialized', { path: home, command });
      io.out(JSON.stringify({ systemMessage: message, hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: message } }));
      return 0;
    }

    const project = projectFor(home, input, env);
    if (!project) return 0;

    if (event === 'session-start') {
      const { tasks } = listTasks(home, project.slug);
      io.out(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: sessionContext(lang, project.slug, tasks) } }));
      return 0;
    }
    if (event === 'prompt') {
      const prompt = typeof input.prompt === 'string' ? input.prompt : '';
      // Every message replaces the previous orders, so only the latest message counts.
      recordOrders(home, project.slug, extractOrders(prompt, project.idPrefix), now());
      return 0;
    }
    if (event === 'stop') {
      if (input.stop_hook_active === true) return 0;
      // Without the transcript the hook cannot tell which task was worked on: progress on any
      // in-progress task, or a free log entry for minor work, is enough.
      const inProgress = listTasks(home, project.slug).tasks.filter((x) => x.status === 'in-progress');
      const day = localDay(new Date(now()));
      const recorded = inProgress.some((x) => hasHistoryFor(x.history, day)) || hasFreeLogFor(home, project.slug, day);
      if (inProgress.length > 0 && !recorded) {
        io.out(JSON.stringify({ decision: 'block', reason: t(lang, 'hook.stop.reason') }));
      }
      return 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}
