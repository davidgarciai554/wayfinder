import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveLang, t, type Lang } from './i18n/index.ts';
import { hasLogFor } from './store/log.ts';
import { extractOrders, recordOrders } from './store/mentions.ts';
import { getHome, isWithin } from './store/paths.ts';
import { matchProject, findRepoRoot } from './store/resolve.ts';
import { listTasks, type Task } from './store/tasks.ts';
import { localDay } from './store/time.ts';

export const HOOK_EVENTS = ['session-start', 'prompt', 'pre-tool', 'stop'] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HookIo {
  stdin: () => string;
  out: (text: string) => void;
}

const MAX_CONTEXT = 4000;
const MAX_TITLE = 80;

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

const clean = (text: string, max: number) => {
  const flat = text.replace(/[\u0000-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

function projectFor(home: string, input: Record<string, unknown>, env: NodeJS.ProcessEnv) {
  const dir = env.CLAUDE_PROJECT_DIR?.trim() || (typeof input.cwd === 'string' ? input.cwd : '');
  if (!dir) return null;
  const root = findRepoRoot(dir) ?? resolve(dir);
  return matchProject(home, root);
}

/** Only metadata, never task bodies: proposals may carry text from the web (prompt injection). */
export function sessionContext(lang: Lang, slug: string, tasks: Task[]): string {
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(lang, key, vars);
  const row = (x: Task) => `- ${x.id} [${x.status}] (${x.priority}) ${clean(x.title, MAX_TITLE)}`;
  const active = tasks.filter((x) => x.status === 'in-progress' || x.status === 'todo');
  const proposed = tasks.filter((x) => x.status === 'proposed');
  const lines = [tr('hook.session.header', { slug }), `language: ${lang}`, tr('hook.session.skill')];
  lines.push('', tr('hook.session.active'), ...(active.length ? active.map(row) : [tr('hook.session.none')]));
  if (proposed.length) lines.push('', tr('hook.session.proposed'), ...proposed.map(row));
  let text = lines.join('\n');
  if (text.length > MAX_CONTEXT) text = `${text.slice(0, MAX_CONTEXT - 40)}\n${tr('hook.session.truncated')}`;
  return text;
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
      const inProgress = listTasks(home, project.slug).tasks.some((x) => x.status === 'in-progress');
      if (inProgress && !hasLogFor(home, project.slug, localDay(new Date(now())))) {
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
