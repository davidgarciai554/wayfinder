// Increment 6: checks of the Docker image against a real Docker engine (Docker Desktop on Windows).
// Run with `npm run test:docker` after `docker build -t wayfinder:dev .`. Not part of `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { initHome } from '../../src/store/init.ts';
import { createProject } from '../../src/store/project.ts';
import { createTask, listTasks } from '../../src/store/tasks.ts';
import { commitCount, gitOut } from '../helpers.ts';

const IMAGE = process.env.WAYFINDER_IMAGE ?? 'wayfinder:dev';
const DOCKER = process.env.DOCKER ?? 'docker';
const HARDENING = ['--read-only', '--tmpfs', '/tmp', '--cap-drop=ALL', '--security-opt', 'no-new-privileges'];
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

const docker = (...args: string[]) => execFileSync(DOCKER, args, { encoding: 'utf8' }).trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function workspace(t: { after: (fn: () => void | Promise<void>) => void }) {
  const base = mkdtempSync(join(tmpdir(), 'wf-docker-'));
  const home = join(base, 'home');
  initHome(home);
  createProject(home, { slug: 'demo', name: 'Demo', idPrefix: 'DEM', localPath: '/workspace' });
  t.after(() => rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  return { base, home };
}

function http(port: number, path: string, options: { method?: string; host?: string; headers?: Record<string, string>; body?: string; address?: string } = {}) {
  return new Promise<{ status: number; body: string; headers: Record<string, unknown> }>((resolve, reject) => {
    const req = request({ host: options.address ?? '127.0.0.1', port, path, method: options.method ?? 'GET', headers: { Host: options.host ?? `127.0.0.1:${port}`, ...options.headers }, timeout: 3000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(options.body);
  });
}

async function waitFor(check: () => Promise<boolean>, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

test('the image has git and runs as an unprivileged user', () => {
  assert.match(docker('run', '--rm', '--entrypoint', 'git', IMAGE, '--version'), /^git version \d/);
  assert.equal(docker('run', '--rm', '--entrypoint', 'id', IMAGE, '-u'), '1000');
  assert.equal(docker('image', 'inspect', IMAGE, '--format', '{{json .Config.Volumes}}'), 'null', 'no VOLUME instruction');
});

test('without a mounted, initialised folder serve and mcp exit with a clear error', () => {
  for (const command of [[], ['mcp']]) {
    const r = spawnSync(DOCKER, ['run', '--rm', ...HARDENING, '-e', 'WAYFINDER_LANG=es', IMAGE, ...command], { encoding: 'utf8', input: '' });
    assert.notEqual(r.status, 0, command.join(' ') || 'serve');
    assert.match(r.stderr, /No hay carpeta de datos en \/data/);
  }
});

test('web: loopback only, Host allow-list, writes commit in LF, host edits appear with polling', { timeout: 120_000 }, async (t) => {
  const { home } = workspace(t);
  const port = 4791;
  const name = `wf-web-${process.pid}`;
  docker('run', '-d', '--name', name, '-p', `127.0.0.1:${port}:4747`, '-e', `WAYFINDER_PUBLIC_PORT=${port}`, '-v', `${home}:/data`, ...HARDENING, IMAGE);
  t.after(() => void spawnSync(DOCKER, ['rm', '-f', name]));
  assert.ok(await waitFor(async () => (await http(port, '/api/projects')).status === 200, 30_000), docker('logs', name));

  const inspect = JSON.parse(docker('inspect', name))[0];
  assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(inspect.HostConfig.CapDrop, ['ALL']);
  assert.equal(inspect.Config.User, 'node');
  assert.equal(docker('exec', name, 'id', '-u'), '1000');

  assert.equal((await http(port, '/api/projects', { host: 'evil.example.com' })).status, 403);
  assert.equal((await http(port, '/api/projects', { host: `localhost:${port}` })).status, 200);
  const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  if (lan) await assert.rejects(http(port, '/api/projects', { address: lan, host: `${lan}:${port}` }), 'not reachable from the LAN address');

  // The key is printed in the container log (documented risk); use it like the person would.
  const key = docker('logs', name).match(/k=([0-9a-f]{48})/)?.[1];
  assert.ok(key, 'serve prints the key link');
  assert.match(docker('logs', name), new RegExp(`127\\.0\\.0\\.1:${port}/\\?k=`), 'the link shows the published port');
  const landing = await http(port, `/?k=${key}`);
  const cookie = String((landing.headers['set-cookie'] as string[])[0]).split(';')[0];
  const before = commitCount(home);
  const created = await http(port, '/api/projects/demo/tasks', {
    method: 'POST',
    headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ title: 'Desde Docker', body: 'línea 1\r\nlínea 2' }),
  });
  assert.equal(created.status, 201, created.body);
  assert.deepEqual(JSON.parse(created.body).warnings, [], 'commit without "dubious ownership"');
  assert.equal(commitCount(home), before + 1);
  assert.equal(gitOut(home, 'log', '-1', '--format=%an %s'), 'Wayfinder wf: create DEM-1');
  const file = join(home, 'projects', 'demo', 'tasks', 'DEM-1-desde-docker.md');
  assert.doesNotMatch(readFileSync(file, 'utf8'), /\r/, 'LF line endings');

  // An edit on the host reaches the browser through polling within 3 s.
  const changed = new Promise<boolean>((resolve) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/events', headers: { Host: `127.0.0.1:${port}` } }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (d: string) => d.includes('event: change') && (req.destroy(), resolve(true)));
    });
    req.on('error', () => resolve(false));
    req.end();
    setTimeout(() => (req.destroy(), resolve(false)), 3000);
  });
  await sleep(200);
  writeFileSync(file, readFileSync(file, 'utf8').replace('Desde Docker', 'Editada en el host'));
  assert.equal(await changed, true, 'change event within 3 s');
});

async function mcpClient(t: { after: (fn: () => Promise<void>) => void }, mounts: string[], env: Record<string, string>) {
  const args = ['run', '-i', '--rm', '--network', 'none', ...HARDENING, ...mounts, ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), IMAGE, 'mcp'];
  const transport = new StdioClientTransport({ command: DOCKER, args, stderr: 'pipe' });
  const client = new Client({ name: 'wayfinder-docker-test', version: '0.0.0' });
  await client.connect(transport);
  t.after(() => client.close());
  const call = async (name: string, a: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: a })) as { isError?: boolean; content: Array<{ text: string }> };
    return { isError: Boolean(r.isError), text: r.content.map((c) => c.text).join('\n') };
  };
  return { client, call };
}

test('MCP over stdio in a container: explicit project, captures, plan rule and chat approval', { timeout: 180_000 }, async (t) => {
  const { base, home } = workspace(t);
  const repo = join(base, 'repo');
  mkdirSync(join(repo, 'Planes'), { recursive: true });
  writeFileSync(join(repo, 'Planes', '2026-10-22-docker.md'), '# Plan\n');
  const captures = join(base, 'captures');
  mkdirSync(captures);
  writeFileSync(join(captures, 'shot.png'), PNG);
  const common = { WAYFINDER_PROJECT: 'demo', WAYFINDER_LANG: 'en' };

  // Without the consumer repository mounted.
  const bare = await mcpClient(t, ['-v', `${home}:/data`, '-v', `${captures}:/captures:ro`], { ...common, WAYFINDER_CAPTURES_DIR: '/captures' });
  const tools = (await bare.client.listTools()).tools.map((x) => x.name);
  assert.equal(tools.length, 11);
  assert.match((await bare.call('wf_create', { title: 'Docker task' })).text, /DEM-1 .*proposed/);
  assert.match((await bare.call('wf_list')).text, /DEM-1 \[proposed\]/);
  const attached = await bare.call('wf_attach', { path: '/captures/shot.png', alt: 'Board', task_id: 'DEM-1' });
  assert.equal(attached.isError, false, attached.text);
  assert.equal((await bare.call('wf_attach', { path: '/etc/hostname', alt: 'x' })).isError, true, 'outside /captures');
  assert.equal((await bare.call('wf_attach', { path: '/data/projects/demo/PROJECT.md', alt: 'x' })).isError, true);
  // Chat approval fails closed: no prompt hook writes chat-mentions in this setup.
  const approve = await bare.call('wf_set_status', { id: 'DEM-1', status: 'todo', user_requested: true, user_quote: 'approve DEM-1', review_verdict: 'clean' });
  assert.equal(approve.isError, true);
  assert.match(approve.text, /explicit order/);
  // Plan rule without /workspace: fails closed with an explanation.
  createTask(home, 'demo', { title: 'Host task' }, 'web');
  assert.equal((await bare.call('wf_update', { id: 'DEM-2', plan: 'Planes/2026-10-22-docker.md' })).isError, true);

  // With the consumer repository mounted read-only, the plan can be verified.
  const withRepo = await mcpClient(t, ['-v', `${home}:/data`, '-v', `${repo}:/workspace:ro`], { ...common, CLAUDE_PROJECT_DIR: '/workspace' });
  assert.equal((await withRepo.call('wf_update', { id: 'DEM-2', plan: 'Planes/2026-10-22-docker.md' })).isError, false);
  assert.match((await withRepo.call('wf_set_status', { id: 'DEM-2', status: 'in-progress' })).text, /in-progress/);
  assert.match(gitOut(home, 'log', '-1', '--format=%s'), /DEM-2 todo->in-progress/);
});

test('locks between host and container: 20 alternating writes, no duplicate IDs', { timeout: 180_000 }, async (t) => {
  const { home } = workspace(t);
  const { call } = await mcpClient(t, ['-v', `${home}:/data`], { WAYFINDER_PROJECT: 'demo', WAYFINDER_LANG: 'en' });
  const container = (async () => {
    for (let i = 0; i < 10; i++) assert.equal((await call('wf_create', { title: `Container ${i}` })).isError, false);
  })();
  const host = (async () => {
    for (let i = 0; i < 10; i++) {
      createTask(home, 'demo', { title: `Host ${i}` }, 'web');
      await sleep(30);
    }
  })();
  await Promise.all([container, host]);
  const ids = listTasks(home, 'demo').tasks.map((x) => x.id);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20, `duplicate IDs: ${ids.sort().join(' ')}`);
});
