import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook } from '../src/hook.ts';
import en from '../src/i18n/en.json' with { type: 'json' };
import es from '../src/i18n/es.json' with { type: 'json' };
import { approveByChat } from '../src/store/approve.ts';
import { extractOrders, isAutomatedTurn, isBareApproval } from '../src/store/mentions.ts';
import { getHome } from '../src/store/paths.ts';
import { createProject } from '../src/store/project.ts';
import { resolveProject } from '../src/store/resolve.ts';
import { reviewTask } from '../src/store/review.ts';
import { createTask, setStatus } from '../src/store/tasks.ts';
import { makeHome } from './helpers.ts';

/** Real Codex CLI 0.172.0 stdin payloads (test/fixtures/hooks/codex), with <CWD> pointed at the test repository. */
function fixture(name: string, cwd: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  const raw = readFileSync(fileURLToPath(new URL(`./fixtures/hooks/codex/${name}.json`, import.meta.url)), 'utf8');
  return { ...JSON.parse(raw), cwd, ...patch };
}

function setup(t: Parameters<typeof makeHome>[0]) {
  const home = makeHome(t);
  const repo = join(home, '..', 'consumer');
  mkdirSync(repo);
  execFileSync('git', ['init', '-q', repo]);
  createProject(home, { slug: 'consumer', name: 'Consumer', idPrefix: 'CO', localPath: repo });
  // Codex sets no CLAUDE_PROJECT_DIR: the project comes from the payload's cwd.
  return { home, repo, env: { WAYFINDER_HOME: home, WAYFINDER_LANG: 'es' } };
}

function hook(event: string, input: unknown, env: Record<string, string>, now?: () => number) {
  let out = '';
  const code = runHook(event, { stdin: () => JSON.stringify(input), out: (s) => (out += s) }, env, now);
  return { code, out, json: out ? JSON.parse(out) : null };
}

const orders = (home: string) => {
  const file = join(home, '.state', 'chat-mentions.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).consumer?.ids ?? [] : [];
};

test('Codex SessionStart gets the project context from the payload cwd', (t) => {
  const { home, repo, env } = setup(t);
  createTask(home, 'consumer', { title: 'Tarea activa' }, 'web');
  const r = hook('session-start', fixture('session-start', repo), env);
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(r.json.hookSpecificOutput.additionalContext, /CO-1 \[todo\]/);
});

test('Codex UserPromptSubmit records the person\'s order and nothing from an ordinary prompt', (t) => {
  const { home, repo, env } = setup(t);
  assert.equal(hook('prompt', fixture('user-prompt-submit', repo), env).out, '');
  assert.deepEqual(orders(home), []);
  hook('prompt', fixture('user-prompt-submit', repo, { prompt: 'aprueba CO-1' }), env);
  assert.deepEqual(orders(home), ['CO-1']);
});

test('Codex PreToolUse: apply_patch and the shell are denied inside the data folder, allowed elsewhere', (t) => {
  const { home, repo, env } = setup(t);
  const deny = (input: Record<string, unknown>) => hook('pre-tool', input, env).json?.hookSpecificOutput?.permissionDecision === 'deny';
  const patch = (header: string) => fixture('pre-tool-use-apply-patch', repo, { tool_input: { command: `*** Begin Patch\n${header}\n+hi\n*** End Patch` } });
  assert.ok(!deny(fixture('pre-tool-use-apply-patch', repo)), 'the captured patch adds a file in the repository');
  assert.ok(!deny(fixture('pre-tool-use-bash', repo)));
  assert.ok(deny(patch(`*** Add File: ${join(home, 'projects', 'consumer', 'tasks', 'CO-1-x.md')}`)));
  assert.ok(deny(patch(`*** Update File: ${join('..', 'home', 'config.json')}`)), 'relative to the payload cwd');
  assert.ok(deny(patch(`*** Delete File: ${join(home, 'config.json')}`)));
  assert.ok(deny(patch(`*** Update File: src/a.ts\n*** Move to: ${join(home, 'a.ts')}`)));
  assert.ok(!deny(patch('*** Update File: src/a.ts')));
  assert.ok(deny(fixture('pre-tool-use-bash', repo, { tool_input: { command: `type "${home}\\config.json"` } })));
});

test('Codex Stop blocks once with the fixed reason, and the reason sent back as a prompt neither gives nor clears orders', (t) => {
  const { home, repo, env } = setup(t);
  const id = createTask(home, 'consumer', { title: 'Trabajo' }, 'web').task.id;
  setStatus(home, 'consumer', id, 'in-progress', 'mcp', { trivial: true, note: 'cambio mínimo' });
  const day = new Date();
  const tomorrow = () => new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12).getTime();
  const blocked = hook('stop', fixture('stop', repo), env, tomorrow).json;
  assert.equal(blocked.decision, 'block');
  assert.ok(blocked.reason.startsWith('[wayfinder-stop] '));
  assert.equal(hook('stop', fixture('stop-continued', repo), env, tomorrow).out, '', 'stop_hook_active ends it');
  hook('prompt', fixture('user-prompt-submit', repo, { prompt: 'aprueba CO-1' }), env);
  hook('prompt', fixture('user-prompt-submit', repo, { prompt: blocked.reason }), env);
  assert.deepEqual(orders(home), ['CO-1'], 'the continuation does not clear the pending order');
});

test('no Stop reason carries an order and both open with the automatic-turn mark', () => {
  for (const dict of [en, es] as Array<Record<string, string>>) {
    const reason = dict['hook.stop.reason']!;
    assert.ok(isAutomatedTurn(reason));
    assert.deepEqual(extractOrders(reason, 'CO'), []);
    assert.equal(isBareApproval(reason), false);
  }
  assert.equal(isAutomatedTurn('aprueba CO-1 [wayfinder-stop]'), false, 'only at the start');
});

test('without an order from the prompt hook, chat approval fails closed', (t) => {
  const { home } = setup(t);
  const id = createTask(home, 'consumer', { title: 'Idea' }, 'mcp').task.id;
  reviewTask(home, 'consumer', id);
  assert.throws(() => approveByChat(home, 'consumer', id, { userQuote: `aprueba ${id}`, verdict: 'clean' }), /noOrder|order/i);
});

test('an unexpanded ${...} data folder falls back to ~/.wayfinder instead of a literal folder', () => {
  assert.equal(getHome({ WAYFINDER_HOME: '${user_config.home}' }), join(homedir(), '.wayfinder'));
  assert.equal(getHome({ WAYFINDER_HOME: '  ' }), join(homedir(), '.wayfinder'));
});

test('an MCP server started outside the repository (cwd /) resolves no project', (t) => {
  const { home } = setup(t);
  assert.throws(() => resolveProject(home, { cwd: '/', env: {} }), (e: { key?: string }) => e.key === 'resolve.notRegistered');
});


test('the Codex hooks call the global command for the same events as Claude, except the failed-tool reminder', () => {
  const read = (p: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../plugin/${p}`, import.meta.url)), 'utf8'));
  const claude = read('hooks/hooks.json').hooks;
  const codex = read('hooks/codex-hooks.json').hooks;
  assert.deepEqual(Object.keys(codex).sort(), Object.keys(claude).filter((e) => e !== 'PostToolUseFailure').sort());
  for (const [event, groups] of Object.entries(codex) as Array<[string, Array<{ hooks: Array<Record<string, string>> }>]>) {
    const arg = claude[event][0].hooks[0].args.at(-1);
    assert.deepEqual(groups[0]!.hooks[0], { type: 'command', command: `wayfinder hook ${arg}`, commandWindows: `wayfinder.cmd hook ${arg}` });
  }
  const matcher = new RegExp(codex.PreToolUse[0].matcher);
  for (const name of ['Bash', 'apply_patch', 'mcp__terminal__run_in_terminal']) assert.ok(matcher.test(name), name);
  for (const name of ['Read', 'web_search', 'update_plan']) assert.ok(!matcher.test(name), name);
  const manifest = read('.codex-plugin/plugin.json');
  assert.equal(manifest.hooks, './hooks/codex-hooks.json');
  assert.deepEqual(read(manifest.mcpServers.slice(2)).mcpServers.wayfinder, {
    command: 'wayfinder',
    args: ['mcp'],
    env_vars: ['WAYFINDER_HOME', 'WAYFINDER_LANG', 'WAYFINDER_CAPTURES_DIR', 'WAYFINDER_WEB_HOST'],
  });
});

