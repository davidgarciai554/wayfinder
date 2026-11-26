// Acceptance walkthrough for a release candidate (WAY-30). Repeatable and isolated: Claude Code,
// the data folders and the global npm prefix all live in a new temporary folder, so ~/.claude,
// ~/.wayfinder and the user's global npm are never written.
//
//   node scripts/acceptance.mjs [--from-ref <git ref of the previous version>] [--keep]
//
// Needs: npm ci (MCP client and Playwright come from devDependencies), git, and the claude CLI
// for the plugin steps (they are reported as blocked without it). It does not run the test suites:
// docs/aceptacion-1.0.md lists those commands next to these steps.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
// Last commit of main that shipped 0.1.0, the version before 1.0.0.
const fromRef = option('--from-ref', '891a4657c');
const keep = args.includes('--keep');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const T = mkdtempSync(join(tmpdir(), 'wayfinder-acceptance-'));
const results = [];

const { Client } = await import('@modelcontextprotocol/client');
const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');

const isolated = {
  ...process.env,
  CLAUDE_CONFIG_DIR: join(T, 'claude'),
  npm_config_prefix: join(T, 'npm-prefix'),
  npm_config_cache: join(T, 'npm-cache'),
};
delete isolated.WAYFINDER_HOME;

function sh(command, env = isolated, cwd = root) {
  const r = spawnSync(command, { shell: true, env, cwd, encoding: 'utf8', timeout: 300_000 });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}
const q = (p) => `"${p.replace(/[\\/]+$/, '')}"`;
const git = (dir, ...a) => (spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout ?? '').trim();
const short = (text, n = 240) => String(text).replace(/\s+/g, ' ').trim().slice(0, n);

class Blocked extends Error {}
async function step(id, title, fn) {
  try {
    const evidence = await fn();
    results.push({ id, title, result: 'conforme', evidence: short(evidence, 400) });
  } catch (error) {
    results.push({ id, title, result: error instanceof Blocked ? 'bloqueado' : 'desviación', evidence: short(error.stack ?? error.message, 400) });
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function hookRunner(bundle, home, cwd, lang = 'es') {
  const env = { ...isolated, WAYFINDER_HOME: home, WAYFINDER_LANG: lang, CLAUDE_PLUGIN_OPTION_HOME: home, CLAUDE_PLUGIN_OPTION_LANGUAGE: lang, CLAUDE_PROJECT_DIR: cwd };
  return (event, input = {}) => {
    const r = spawnSync(process.execPath, [bundle, 'hook', event], {
      input: JSON.stringify({ cwd, session_id: 'acceptance', hook_event_name: event, ...input }),
      env,
      encoding: 'utf8',
    });
    let out = r.stdout ?? '';
    try {
      out = JSON.parse(out).hookSpecificOutput?.additionalContext ?? out;
    } catch {}
    return `${out}${r.status ? ` [exit ${r.status}] ${r.stderr}` : ''}`.trim();
  };
}

async function mcp(bundle, home, cwd, lang = 'es', extraEnv = {}) {
  const env = { ...isolated, WAYFINDER_HOME: home, WAYFINDER_LANG: lang, CLAUDE_PROJECT_DIR: cwd, ...extraEnv };
  const client = new Client({ name: 'wayfinder-acceptance', version });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bundle, 'mcp'], cwd, env, stderr: 'pipe' }));
  const call = async (name, a = {}) => {
    const r = await client.callTool({ name, arguments: a });
    return { error: Boolean(r.isError), text: r.content.map((c) => c.text).join('\n') };
  };
  return { call, close: () => client.close() };
}

function newRepo(name) {
  const dir = join(T, name);
  mkdirSync(join(dir, 'Planes'), { recursive: true });
  spawnSync('git', ['init', '-q', dir]);
  writeFileSync(join(dir, 'Planes', 'plan.md'), '# Plan de prueba\n');
  return dir;
}

async function serve(bundle, home, lang = 'es') {
  const child = spawn(process.execPath, [bundle, 'serve', '--port', '0'], { env: { ...isolated, WAYFINDER_HOME: home, WAYFINDER_LANG: lang } });
  const url = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`serve did not start: ${out}`)), 15_000);
    child.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/http:\/\/127\.0\.0\.1:\d+\/\?k=[\w.-]+/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    });
  });
  const base = new URL(url).origin;
  const login = await fetch(url, { redirect: 'manual' });
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  const get = async (path) => (await fetch(base + path, { headers: { cookie } })).json();
  const post = async (path, body) => {
    const r = await fetch(base + path, { method: 'POST', headers: { cookie, origin: base, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  return { url, base, get, post, stop: () => child.kill() };
}

const updatedOf = async (web, slug, id) => {
  const j = await web.get(`/api/projects/${slug}/tasks/${id}`);
  return j.task?.updated ?? j.updated;
};

// Read-only fingerprint of the user's real folders, to show the walkthrough did not touch them.
function fingerprint() {
  const wf = join(homedir(), '.wayfinder');
  const claude = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  return {
    wayfinderHead: existsSync(join(wf, '.git')) ? git(wf, 'rev-parse', 'HEAD') : '(none)',
    claudePlugins: existsSync(claude) ? readFileSync(claude, 'utf8') : '(none)',
  };
}
const before = fingerprint();
const hasClaude = sh('claude --version').code === 0;
const candidate = join(root, 'plugin', 'dist', 'wayfinder.mjs');

// 1. Clean install with the README command, in an empty Claude Code profile.
await step('1', 'Instalación limpia del plugin con el comando del README en un perfil vacío', () => {
  if (!hasClaude) throw new Blocked('claude CLI not found');
  const home = join(T, 'data-clean');
  const r = sh(`claude plugin install wayfinder --marketplace ${q(root)} --config language=es --config ${q(`home=${home}`)}`);
  expect(r.code === 0, `install exit ${r.code}: ${r.out}`);
  const list = JSON.parse(sh('claude plugin list --json').out).find((p) => p.id === 'wayfinder@wayfinder');
  expect(list?.version === version, `plugin list version ${list?.version}, expected ${version}`);
  const printed = sh(`node ${q(join(list.readFromFolder ?? list.installPath, 'dist', 'wayfinder.mjs'))} --version`).out;
  expect(printed === version, `--version printed ${printed}`);
  const un = sh('claude plugin uninstall wayfinder@wayfinder');
  sh('claude plugin marketplace remove wayfinder');
  return `install exit 0; plugin list ${list.version}; --version ${printed}; uninstall exit ${un.code}`;
});

await step('1b', 'claude plugin validate del repositorio', () => {
  if (!hasClaude) throw new Blocked('claude CLI not found');
  const r = sh(`claude plugin validate ${q(root)}`);
  expect(r.code === 0, `exit ${r.code}: ${r.out}`);
  return r.out;
});

// 2. Update from the previous version with test data, through a local marketplace.
const upgradeHome = join(T, 'data-upgrade');
const upgradeRepo = newRepo('repo-upgrade');
await step('2', `Actualización desde ${fromRef} (0.1.0) con datos de prueba`, async () => {
  if (!hasClaude) throw new Blocked('claude CLI not found');
  const mkt = join(T, 'marketplace');
  expect(spawnSync('git', ['clone', '-q', root, mkt]).status === 0, 'git clone of the repository failed');
  expect(spawnSync('git', ['-C', mkt, 'checkout', '-q', '--detach', fromRef]).status === 0, `checkout ${fromRef} failed`);
  const oldVersion = JSON.parse(readFileSync(join(mkt, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  const env = { ...isolated, CLAUDE_CONFIG_DIR: join(T, 'claude-upgrade') };
  let r = sh(`claude plugin install wayfinder --marketplace ${q(mkt)} --config language=es --config ${q(`home=${upgradeHome}`)}`, env);
  expect(r.code === 0, `install ${oldVersion}: ${r.out}`);

  const oldBundle = join(mkt, 'plugin', 'dist', 'wayfinder.mjs');
  hookRunner(oldBundle, upgradeHome, upgradeRepo)('prompt', { prompt: 'registra este proyecto' });
  const s = await mcp(oldBundle, upgradeHome, upgradeRepo);
  await s.call('wf_project', { action: 'register' });
  await s.call('wf_create', { title: 'Tarea creada con la 0.1.0', body: 'Datos de prueba.', tags: ['datos'] });
  await s.call('wf_log', { entry: 'Avance registrado con la 0.1.0.', task_id: 'REP-1' });
  await s.call('wf_error', { action: 'create', task_id: 'REP-1', title: 'Error de prueba', kind: 'test', context: 'Datos de la 0.1.0', reproduction: 'npm test', output: 'fallo' });
  await s.close();
  const headBefore = git(upgradeHome, 'rev-parse', 'HEAD');
  expect(headBefore !== '', 'the 0.1.0 session did not create the data folder');

  rmSync(join(mkt, 'plugin'), { recursive: true, force: true });
  cpSync(join(root, 'plugin'), join(mkt, 'plugin'), { recursive: true });
  cpSync(join(root, '.claude-plugin'), join(mkt, '.claude-plugin'), { recursive: true });
  const mu = sh('claude plugin marketplace update wayfinder', env);
  r = sh('claude plugin update wayfinder@wayfinder', env);
  expect(r.code === 0, `update: ${r.out}`);
  const list = JSON.parse(sh('claude plugin list --json', env).out).find((p) => p.id === 'wayfinder@wayfinder');
  expect(list?.version === version, `version after update ${list?.version}: ${r.out}`);
  const inputs = JSON.parse(sh('claude plugin configure wayfinder@wayfinder --json', env).out).inputs;
  expect(inputs.language === 'es' && inputs.home === upgradeHome, `options after update: ${JSON.stringify(inputs)}`);
  expect(git(upgradeHome, 'rev-parse', 'HEAD') === headBefore, 'the update wrote in the data folder');

  const context = hookRunner(candidate, upgradeHome, upgradeRepo)('session-start', { source: 'startup' });
  expect(context.includes('REP-1'), `SessionStart after update does not list REP-1: ${context}`);
  const s2 = await mcp(candidate, upgradeHome, upgradeRepo);
  const got = await s2.call('wf_get', { id: 'REP-1' });
  const w = await s2.call('wf_create', { title: 'Tarea creada con la 1.0.0' });
  await s2.close();
  expect(!got.error && got.text.includes('ERR-1') && !w.error, `read/write after update failed: ${got.text} / ${w.text}`);
  expect(git(upgradeHome, 'status', '--porcelain') === '', 'data folder not clean after the new version wrote');
  return `${oldVersion} → ${list.version} (${short(mu.out, 60)} / ${short(r.out, 100)}); options kept (language=es, home); REP-1 with ERR-1 readable; new write OK; git status clean`;
});

// WAY-24 checks on copies of the upgraded data folder (never the user's).
const copyOf = (name) => {
  const dir = join(T, name);
  cpSync(upgradeHome, dir, { recursive: true });
  return dir;
};
const needData = () => {
  if (!existsSync(join(upgradeHome, 'projects'))) throw new Blocked('step 2 did not create the data folder');
};

await step('2b', 'Carpeta sin marca FORMAT (0.1.0 anterior a la marca): se abre sin aviso y sin cambios', async () => {
  needData();
  const home = copyOf('data-nomark');
  spawnSync('git', ['-C', home, 'rm', '-q', 'FORMAT']);
  spawnSync('git', ['-C', home, 'commit', '-qm', 'acceptance: folder before the FORMAT mark']);
  const head = git(home, 'rev-parse', 'HEAD');
  const context = hookRunner(candidate, home, upgradeRepo)('session-start', { source: 'startup' });
  const s = await mcp(candidate, home, upgradeRepo);
  const list = await s.call('wf_list', {});
  await s.close();
  const web = await serve(candidate, home);
  const projects = await web.get('/api/projects');
  web.stop();
  expect(!existsSync(join(home, 'FORMAT')), 'FORMAT reappeared');
  expect(!/FORMAT/.test(context + list.text) && !JSON.stringify(projects).includes('"format"'), `unexpected format warning: ${short(context)} / ${short(list.text)}`);
  expect(git(home, 'rev-parse', 'HEAD') === head && git(home, 'status', '--porcelain') === '', 'reading changed the folder');
  return 'no warning in SessionStart, wf_list or /api/projects; same HEAD; git status clean';
});

await step('2c', 'Marca FORMAT a 2: aviso en SessionStart, en wf_* y en la web, y solo lectura', async () => {
  needData();
  const home = copyOf('data-format2');
  writeFileSync(join(home, 'FORMAT'), '2\n');
  spawnSync('git', ['-C', home, 'commit', '-qam', 'acceptance: newer format']);
  const head = git(home, 'rev-parse', 'HEAD');
  const context = hookRunner(candidate, home, upgradeRepo)('session-start', { source: 'startup' });
  const s = await mcp(candidate, home, upgradeRepo);
  const list = await s.call('wf_list', {});
  const write = await s.call('wf_create', { title: 'No debe guardarse' });
  await s.close();
  const web = await serve(candidate, home);
  const projects = await web.get('/api/projects');
  const post = await web.post('/api/projects/repo-upgrade/tasks', { title: 'Tampoco desde la web' });
  web.stop();
  const notice = context.split('\n')[0];
  expect(/\b2\b/.test(notice), `SessionStart: ${short(context)}`);
  expect(list.text.includes(notice.slice(0, 40)) || /\b2\b/.test(list.text), `wf_list without warning: ${short(list.text)}`);
  expect(write.error, `wf_create accepted: ${short(write.text)}`);
  expect(JSON.stringify(projects).includes('"format"'), `/api/projects without format: ${short(JSON.stringify(projects))}`);
  expect(post.status === 409, `web POST ${post.status}`);
  expect(git(home, 'rev-parse', 'HEAD') === head, 'something was written');
  return `SessionStart: "${short(notice, 120)}"; wf_list warns; wf_create refused; /api/projects carries format; web POST 409; HEAD unchanged`;
});

await step('2d', 'Tarea con un estado desconocido: se muestra y no admite escrituras', async () => {
  needData();
  const home = copyOf('data-unknown');
  const dir = join(home, 'projects', 'repo-upgrade', 'tasks');
  const file = join(dir, readdirSync(dir).find((f) => f.startsWith('REP-1-')));
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^status: .*$/m, 'status: waiting'));
  spawnSync('git', ['-C', home, 'commit', '-qam', 'acceptance: unknown status']);
  const content = readFileSync(file, 'utf8');
  const s = await mcp(candidate, home, upgradeRepo);
  const got = await s.call('wf_get', { id: 'REP-1' });
  const set = await s.call('wf_set_status', { id: 'REP-1', status: 'done' });
  const log = await s.call('wf_log', { entry: 'No debe guardarse', task_id: 'REP-1' });
  await s.close();
  const web = await serve(candidate, home);
  const tasks = JSON.stringify(await web.get('/api/projects/repo-upgrade/tasks'));
  web.stop();
  expect(!got.error && got.text.includes('waiting'), `wf_get: ${short(got.text)}`);
  expect(set.error && log.error, `writes were accepted: ${short(set.text)} / ${short(log.text)}`);
  expect(tasks.includes('waiting'), 'the web does not list the task with its status');
  expect(readFileSync(file, 'utf8') === content, 'the task file changed');
  return 'wf_get shows "waiting"; wf_set_status and wf_log refused; the web lists it; file unchanged';
});

// 3. Session: register, create, approve by chat and by web, dependencies, tags, block, errors,
// history, search and the Stop hook. Hooks get the same JSON Claude Code sends.
const home = join(T, 'data-session');
const repo = newRepo('demo');
const hook = hookRunner(candidate, home, repo);
const s = await mcp(candidate, home, repo);
const web = { current: null };

await step('3.1', 'Primer uso: aviso de SessionStart en un repositorio sin registrar', () => {
  const context = hook('session-start', { source: 'startup' });
  expect(/registra este proyecto/i.test(context), `SessionStart: ${short(context)}`);
  return short(context, 200);
});
await step('3.2', 'Registrar el repositorio con «registra este proyecto» (sin la orden se rechaza)', async () => {
  const denied = await s.call('wf_project', { action: 'register' });
  hook('prompt', { prompt: 'registra este proyecto' });
  const ok = await s.call('wf_project', { action: 'register' });
  expect(!/DEM/.test(denied.text), `registered without order: ${short(denied.text)}`);
  expect(!ok.error && /DEM/.test(ok.text), `register: ${short(ok.text)}`);
  return `without order: "${short(denied.text, 100)}" → with order: "${short(ok.text, 100)}"`;
});
await step('3.3', 'Crear tareas con etiquetas y filtrar por etiqueta', async () => {
  for (const [title, tags] of [['Exportar a CSV', ['datos']], ['Atajo de teclado', ['web']], ['Validar el CSV', ['datos']], ['Tarea para reabrir', []]]) {
    const r = await s.call('wf_create', { title, body: 'Prueba de aceptación.', tags });
    expect(!r.error, r.text);
  }
  const list = await s.call('wf_list', { tag: ['datos'], status: ['proposed'] });
  expect(list.text.includes('DEM-1') && list.text.includes('DEM-3') && !list.text.includes('DEM-2'), `tag filter: ${short(list.text)}`);
  return 'DEM-1..DEM-4 created; wf_list tag=datos → DEM-1 and DEM-3 only';
});
await step('3.4', 'Aprobar por chat varios IDs en una orden (sin orden se rechaza)', async () => {
  const quote = 'aprueba DEM-1, DEM-3 y DEM-4';
  const denied = await s.call('wf_set_status', { id: 'DEM-1', status: 'todo', user_requested: true, user_quote: quote, review_verdict: 'clean' });
  hook('prompt', { prompt: quote });
  for (const id of ['DEM-1', 'DEM-3', 'DEM-4']) {
    await s.call('wf_review', { id });
    const r = await s.call('wf_set_status', { id, status: 'todo', user_requested: true, user_quote: quote, review_verdict: 'clean' });
    expect(!r.error, `${id}: ${r.text}`);
  }
  expect(denied.error, `approved without an order: ${denied.text}`);
  const got = await s.call('wf_get', { id: 'DEM-1' });
  expect(/approvedVia: chat/.test(got.text), `approvedVia chat not shown: ${short(got.text)}`);
  return `without order: "${short(denied.text, 90)}"; with «${quote}»: DEM-1, DEM-3, DEM-4 → todo (approvedVia: chat)`;
});
await step('3.5', 'Aprobar desde la web (API con la clave; sin clave, 401)', async () => {
  web.current = await serve(candidate, home);
  const r = await web.current.post('/api/projects/demo/tasks/DEM-2/approve', { expectedUpdated: await updatedOf(web.current, 'demo', 'DEM-2') });
  expect(r.status === 200 && r.body.task.status === 'todo' && r.body.task.approvedVia === 'web', `approve: ${r.status} ${JSON.stringify(r.body)}`);
  const nokey = await fetch(`${web.current.base}/api/projects/demo/tasks/DEM-2/discard`, { method: 'POST', headers: { origin: web.current.base, 'content-type': 'application/json' }, body: '{"expectedUpdated":"x"}' });
  expect(nokey.status === 401, `write without key: ${nokey.status}`);
  return 'POST approve → 200, status todo, approvedVia web; without the key → 401';
});
await step('3.6', 'Dependencias: aviso al empezar una tarea con dependencias abiertas', async () => {
  const u = await s.call('wf_update', { id: 'DEM-3', depends_on: ['DEM-1'] });
  expect(!u.error, u.text);
  const r = await s.call('wf_set_status', { id: 'DEM-3', status: 'in-progress', trivial: true, note: 'prueba' });
  expect(!r.error && r.text.includes('DEM-1'), `in-progress: ${short(r.text)}`);
  const list = await s.call('wf_list', {});
  expect(/DEM-3[^\n]*DEM-1/.test(list.text), `wf_list does not show the dependency: ${short(list.text)}`);
  return short(r.text, 200);
});
await step('3.7', 'Hook Stop: bloquea sin avance del día y deja terminar tras wf_log', async () => {
  await s.call('wf_update', { id: 'DEM-1', plan: 'Planes/plan.md' });
  const started = await s.call('wf_set_status', { id: 'DEM-1', status: 'in-progress' });
  expect(!started.error, started.text);
  const blocked = hook('stop', { stop_hook_active: false });
  expect(/"decision"\s*:\s*"block"/.test(blocked), `Stop without progress: ${short(blocked)}`);
  const log = await s.call('wf_log', { task_id: 'DEM-1', entry: 'Primer borrador de la exportación.', files: 'src/export.ts', next: 'Pruebas' });
  expect(!log.error, log.text);
  await s.call('wf_log', { task_id: 'DEM-3', entry: 'Revisado el formato.' });
  const free = hook('stop', { stop_hook_active: false });
  expect(!/"block"/.test(free), `Stop after wf_log: ${short(free)}`);
  return `before: ${short(blocked, 140)}; after wf_log: "${short(free, 40)}"`;
});
await step('3.8', 'Bloquear una tarea con su motivo', async () => {
  const r = await s.call('wf_log', { task_id: 'DEM-3', entry: 'Parada a la espera del formato.', blocked: true, blockers: 'Falta decidir el separador' });
  expect(!r.error, r.text);
  const got = await s.call('wf_get', { id: 'DEM-3' });
  const row = hook('session-start', { source: 'startup' }).split('\n').find((l) => l.includes('DEM-3')) ?? '';
  expect(got.text.includes('Falta decidir el separador'), `wf_get: ${short(got.text)}`);
  return `wf_get shows the reason; SessionStart row: ${short(row, 120)}`;
});
await step('3.9', 'Errores: crear, listar, resolver y descartar; aviso de PostToolUseFailure', async () => {
  const a = await s.call('wf_error', { action: 'create', task_id: 'DEM-1', title: 'npm test falla en export', kind: 'test', context: 'Aceptación', reproduction: 'npm test', output: 'AssertionError', cause: 'Hipótesis: cabecera', cause_kind: 'hypothesis' });
  const b = await s.call('wf_error', { action: 'create', task_id: 'DEM-1', title: 'Puerto ocupado', kind: 'environment', context: 'Aceptación', reproduction: 'serve', output: 'EADDRINUSE' });
  expect(!a.error && !b.error, `${a.text} / ${b.text}`);
  const open = await s.call('wf_errors', {});
  const res = await s.call('wf_error', { action: 'resolve', id: 'ERR-1', solution: 'Saltar la cabecera', validation: 'npm test' });
  const dis = await s.call('wf_error', { action: 'discard', id: 'ERR-2', note: 'No era un fallo' });
  expect(!res.error && !dis.error, `${res.text} / ${dis.text}`);
  const after = await s.call('wf_errors', {});
  const all = await s.call('wf_errors', { status: ['open', 'resolved', 'discarded'] });
  const reminder = hook('post-tool-failure', { tool_name: 'Bash', tool_input: { command: 'npm test' }, error: 'Exit code 1', is_interrupt: false });
  expect(open.text.includes('ERR-1') && open.text.includes('ERR-2'), `open: ${short(open.text)}`);
  expect(!after.text.includes('ERR-1') && all.text.includes('ERR-2'), `after: ${short(after.text)} / ${short(all.text)}`);
  expect(/wf_error/.test(reminder), `PostToolUseFailure: ${short(reminder)}`);
  return 'ERR-1 resolved, ERR-2 discarded, default wf_errors shows no open error; PostToolUseFailure reminds wf_error';
});
await step('3.10', 'Historial y búsqueda', async () => {
  const h = await s.call('wf_history', { task_id: 'DEM-1' });
  const f = await s.call('wf_search', { query: 'exportación' });
  expect(h.text.includes('Primer borrador'), `wf_history: ${short(h.text)}`);
  expect(f.text.includes('DEM-1'), `wf_search: ${short(f.text)}`);
  return 'wf_history lists the progress entry; wf_search finds DEM-1';
});
await step('3.11', 'Reabrir desde la web: 409 con una versión antigua y 200 con la actual', async () => {
  if (!web.current) throw new Blocked('the web did not start in 3.5');
  await s.call('wf_set_status', { id: 'DEM-4', status: 'in-progress', trivial: true, note: 'prueba' });
  await s.call('wf_set_status', { id: 'DEM-4', status: 'done' });
  const fresh = await updatedOf(web.current, 'demo', 'DEM-4');
  const conflict = await web.current.post('/api/projects/demo/tasks/DEM-4/reopen', { expectedUpdated: '2000-01-01T00:00:00+01:00', note: 'Falta un caso' });
  const ok = await web.current.post('/api/projects/demo/tasks/DEM-4/reopen', { expectedUpdated: fresh, note: 'Falta un caso' });
  expect(conflict.status === 409, `stale reopen: ${conflict.status} ${JSON.stringify(conflict.body)}`);
  expect(ok.status === 200 && ok.body.task.status === 'todo', `reopen: ${ok.status} ${JSON.stringify(ok.body)}`);
  return `stale → 409 "${short(conflict.body.error, 100)}"; current → 200 todo`;
});
await step('3.12', 'wf_web en red con el 4747 ocupado: aviso con los dos puertos (ERR-4)', async () => {
  const blocker = createServer();
  const held = await new Promise((resolve) => blocker.once('error', () => resolve(false)).listen(4747, '127.0.0.1', () => resolve(true)));
  const s2 = await mcp(candidate, home, repo, 'es', { WAYFINDER_WEB_HOST: '127.0.0.2' });
  hook('prompt', { prompt: 'abre Wayfinder' });
  const r = await s2.call('wf_web', { action: 'start' });
  await s2.call('wf_web', { action: 'stop' });
  await s2.close();
  if (held) blocker.close();
  const port = r.text.match(/127\.0\.0\.1:(\d+)/)?.[1];
  expect(!r.error && port && port !== '4747', `wf_web start: ${short(r.text)}`);
  expect(r.text.includes('4747') && r.text.includes(port), `no warning with both ports: ${short(r.text)}`);
  return `4747 ${held ? 'held by this script' : 'already in use by another process'}; opened on ${port} with the warning naming both ports`;
});

// 4. Web on a PC and on a phone viewport (Chromium emulation; a real phone is not automated).
await step('4', 'Web en PC (1440 px) y en móvil emulado (390 px, táctil)', async () => {
  if (!web.current) throw new Blocked('the web did not start in 3.5');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const notes = [];
  try {
    for (const [name, opts] of [['pc', { viewport: { width: 1440, height: 900 } }], ['movil', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]]) {
      const page = await browser.newPage(opts);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(web.current.url);
      await page.goto(`${web.current.base}/#/demo/board`);
      await page.getByText('Exportar a CSV').first().waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      mkdirSync(join(T, 'shots'), { recursive: true });
      await page.screenshot({ path: join(T, 'shots', `${name}.png`), fullPage: true });
      expect(errors.length === 0, `${name}: console errors ${errors.join(' | ')}`);
      expect(!overflow, `${name}: horizontal overflow`);
      notes.push(`${name} OK`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return `${notes.join(', ')}, no console errors, no horizontal overflow; screenshots in ${join(T, 'shots')}`;
});
web.current?.stop();
await s.close();

// 5. npm package (WAY-31): pack, install the tarball in a temporary prefix and run the binary.
await step('5', 'Paquete npm: npm pack, instalación del tarball en un prefijo temporal y binario', () => {
  const pack = sh(`npm pack --pack-destination ${q(T)}`);
  expect(pack.code === 0, pack.out);
  const tgz = readdirSync(T).find((f) => f.endsWith('.tgz'));
  const inst = sh(`npm install -g ${q(join(T, tgz))}`);
  expect(inst.code === 0, inst.out);
  const prefix = isolated.npm_config_prefix;
  const bin = process.platform === 'win32' ? join(prefix, 'wayfinder.cmd') : join(prefix, 'bin', 'wayfinder');
  const v = sh(`${q(bin)} --version`).out;
  expect(v === version, `--version ${v}`);
  const cliHome = join(T, 'data-cli');
  const init = sh(`${q(bin)} init --lang es`, { ...isolated, WAYFINDER_HOME: cliHome });
  expect(init.code === 0 && existsSync(join(cliHome, 'FORMAT')), `init: ${init.out}`);
  const un = sh('npm uninstall -g @davidgarciai554/wayfinder');
  expect(un.code === 0 && !existsSync(bin), `uninstall: ${un.out}`);
  return `${tgz}; --version ${v}; init created the data folder with FORMAT; uninstall removed the binary`;
});

const after = fingerprint();
results.push({
  id: '6',
  title: 'Aislamiento: ~/.wayfinder y los plugins de ~/.claude del usuario sin cambios',
  result: JSON.stringify(before) === JSON.stringify(after) ? 'conforme' : 'desviación',
  evidence: JSON.stringify(before) === JSON.stringify(after) ? `same HEAD of ~/.wayfinder (${before.wayfinderHead.slice(0, 7)}) and same installed_plugins.json` : 'changed during the run (another live session can also change them)',
});

const table = ['| Paso | Comprobación | Resultado | Evidencia |', '|---|---|---|---|', ...results.map((r) => `| ${r.id} | ${r.title} | ${r.result} | ${r.evidence.replaceAll('|', '\\|')} |`)].join('\n');
writeFileSync(join(T, 'acceptance-results.json'), JSON.stringify({ version, fromRef, date: new Date().toISOString(), results }, null, 2));
console.log(`Wayfinder ${version} · acceptance · ${new Date().toISOString()}\nTemporary folder: ${T}\n\n${table}`);
if (!keep) {
  for (const name of readdirSync(T)) if (!['shots', 'acceptance-results.json'].includes(name)) rmSync(join(T, name), { recursive: true, force: true, maxRetries: 5 });
}
process.exitCode = results.some((r) => r.result !== 'conforme') ? 1 : 0;
