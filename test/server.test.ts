import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type RunningServer } from '../src/server.ts';
import { createTask, logProgress } from '../src/store/tasks.ts';
import { createError, noteError } from '../src/store/error-records.ts';
import { setGitRunner } from '../src/store/git.ts';
import { WayfinderError } from '../src/store/errors.ts';
import { createServer as createNetServer } from 'node:net';
import { once } from 'node:events';
import { commitCount, gitOut, makeHome, makeProject, tree } from './helpers.ts';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

function get(port: number, path: string, host = `127.0.0.1:${port}`): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { Host: host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function waitForChange(port: number, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/events', headers: { Host: `127.0.0.1:${port}` } }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (d: string) => {
        if (d.includes('event: change')) {
          req.destroy();
          resolve(true);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.end();
    setTimeout(() => {
      req.destroy();
      resolve(false);
    }, timeoutMs);
  });
}

async function serve(t: Parameters<typeof makeHome>[0], extra: { poll?: boolean; publicPort?: number; lang?: 'es' | 'en' } = {}) {
  const home = makeHome(t);
  makeProject(home);
  const webDir = mkdtempSync(join(tmpdir(), 'wf-web-'));
  writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>x</title>');
  const server: RunningServer = await startServer({ home, lang: extra.lang ?? 'en', port: 0, webDir, ...extra });
  t.after(async () => {
    await server.close();
    rmSync(webDir, { recursive: true, force: true });
  });
  return { home, server, port: server.port };
}

test('binds to 127.0.0.1, sends security headers and rejects foreign Host headers', async (t) => {
  const { port } = await serve(t);
  const ok = await get(port, '/');
  assert.equal(ok.status, 200);
  assert.match(String(ok.headers['content-security-policy']), /default-src 'none'; script-src 'self'/);
  assert.equal(ok.headers['x-content-type-options'], 'nosniff');
  assert.equal(ok.headers['access-control-allow-origin'], undefined);
  assert.equal((await get(port, '/', `localhost:${port}`)).status, 200);
  for (const host of ['evil.example.com', `evil.example.com:${port}`, '127.0.0.1:1', `192.168.1.10:${port}`]) {
    assert.equal((await get(port, '/api/projects', host)).status, 403, host);
  }
});

test('refuses a port where another app already listens (even on 0.0.0.0), and serves /index.html', async (t) => {
  const other = createNetServer().listen(0, '0.0.0.0');
  await once(other, 'listening');
  t.after(() => other.close());
  const busyPort = (other.address() as { port: number }).port;
  const home = makeHome(t);
  await assert.rejects(startServer({ home, lang: 'es', port: busyPort, webDir: tmpdir() }), (error: WayfinderError) => {
    assert.equal(error.key, 'serve.portInUse');
    assert.equal(error.vars.port, busyPort);
    return true;
  });
  const { port, server } = await serve(t);
  assert.equal((await get(port, '/index.html')).status, 200);
  const landing = await get(port, `/index.html?k=${server.token}`);
  assert.equal(landing.status, 303);
  assert.match(String(landing.headers['set-cookie']), /HttpOnly/);
});

test('WAYFINDER_PUBLIC_PORT is accepted in the Host header (Docker port mapping)', async (t) => {
  const { port } = await serve(t, { publicPort: 8080 });
  assert.equal((await get(port, '/api/projects', '127.0.0.1:8080')).status, 200);
  assert.equal((await get(port, '/api/projects', 'localhost:8080')).status, 200);
  assert.equal((await get(port, '/api/projects', 'evil.example.com:8080')).status, 403);
});

test('lists projects and tasks with flags, and renders task Markdown safely', async (t) => {
  const { home, port } = await serve(t);
  createTask(home, 'demo', {
    title: '<img src=x onerror=alert(1)>',
    body: [
      '# Heading',
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(2)">',
      '[bad](javascript:alert(3)) [data](data:text/html;base64,AAAA) [ok](https://example.com)',
      '![remote](https://evil.example.com/pixel.png) ![local](../assets/pic.png)',
    ].join('\n\n'),
  }, 'mcp');
  const projects = JSON.parse((await get(port, '/api/projects')).body);
  assert.equal(projects.projects[0].slug, 'demo');
  assert.equal(projects.projects[0].counts.proposed, 1);
  const list = JSON.parse((await get(port, '/api/projects/demo/tasks')).body);
  assert.equal(list.tasks[0].id, 'WF-1');
  assert.equal(list.tasks[0].modifiedOutside, false);
  const task = JSON.parse((await get(port, '/api/projects/demo/tasks/WF-1')).body);
  const html: string = task.html;
  // Raw HTML survives only as escaped text: no live tags, handlers or dangerous link targets.
  assert.doesNotMatch(html, /<script|<img[^>]*onerror|href="(javascript|data):/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<h2>Heading<\/h2>/);
  assert.match(html, /href="https:\/\/example\.com" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /evil\.example\.com/);
  assert.match(html, /src="\/api\/projects\/demo\/assets\/pic\.png"/);
  assert.equal(task.title, '<img src=x onerror=alert(1)>', 'titles are data; the client renders them with textContent');
});

test('assets are served only from the project assets folder', async (t) => {
  const { home, port } = await serve(t);
  writeFileSync(join(home, 'projects/demo/assets/pic.png'), PNG);
  writeFileSync(join(home, 'projects/demo/PROJECT-copy.png'), PNG);
  const ok = await get(port, '/api/projects/demo/assets/pic.png');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['content-type'], 'image/png');
  for (const path of [
    '/api/projects/demo/assets/..%2FPROJECT-copy.png',
    '/api/projects/demo/assets/..%5CPROJECT-copy.png',
    '/api/projects/demo/assets/%2e%2e%2f%2e%2e%2f.gitignore',
    '/api/projects/..%2F..%2F/assets/pic.png',
    '/api/projects/demo/assets/PROJECT.md',
    '/api/projects/demo/assets/missing.png',
    '/../../.gitignore',
    '/api/projects/demo/tasks/..%2F..%2FPROJECT',
  ]) {
    const r = await get(port, path);
    assert.ok(r.status === 404 || r.status === 400, `${path} → ${r.status}`);
  }
});

test('log days and project page are rendered; unknown routes are 404 and writes are refused', async (t) => {
  const { home, port } = await serve(t, { lang: 'es' });
  mkdirSync(join(home, 'projects/demo/log'), { recursive: true });
  writeFileSync(join(home, 'projects/demo/log/2026-10-21.md'), '# 2026-10-21\n\n## 13:40 · WF-1\n\nHecho\n');
  assert.deepEqual(JSON.parse((await get(port, '/api/projects/demo/log')).body).days, ['2026-10-21']);
  const day = JSON.parse((await get(port, '/api/projects/demo/log/2026-10-21')).body);
  assert.match(day.html, /<h3>13:40 · WF-1<\/h3>/);
  assert.doesNotMatch(day.html, /<h2>2026-10-21/);
  assert.equal((await get(port, '/api/projects/nope')).status, 404);
  assert.match(JSON.parse((await get(port, '/api/projects/nope')).body).error, /No existe el proyecto/);
  assert.equal((await get(port, '/api/whatever')).status, 404);
  const i18n = JSON.parse((await get(port, '/api/i18n')).body);
  assert.equal(i18n.lang, 'es');
  assert.equal(i18n.messages['status.todo'], 'por hacer');
  const post = await new Promise<number>((resolve) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/projects', method: 'POST', headers: { Host: `127.0.0.1:${port}` } }, (res) => resolve(res.statusCode ?? 0));
    req.end();
  });
  assert.equal(post, 405);
});

for (const poll of [false, true]) {
  test(`an external edit emits a change event (${poll ? 'polling' : 'fs.watch'})`, { timeout: 15_000 }, async (t) => {
    const { home, port } = await serve(t, { poll });
    const { task } = createTask(home, 'demo', { title: 'Editable' }, 'web');
    await new Promise((r) => setTimeout(r, 300));
    const changed = waitForChange(port, poll ? 6000 : 3000);
    await new Promise((r) => setTimeout(r, 200));
    const file = join(home, task.file);
    writeFileSync(file, readFileSync(file, 'utf8').replace('Editable', 'Editado fuera'));
    assert.equal(await changed, true);
  });
}

// ---------- writes (increment 5) ----------

interface Reply {
  status: number;
  headers: Record<string, unknown>;
  body: string;
}

function post(port: number, path: string, body: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text }));
    });
    // The server may answer (413) before reading the whole body.
    req.on('error', (error: NodeJS.ErrnoException) => (error.code === 'ECONNRESET' || error.code === 'EPIPE' ? undefined : reject(error)));
    req.end(payload);
  });
}

function getWithCookie(port: number, path: string, cookie: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { Host: `127.0.0.1:${port}`, Cookie: cookie } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve(text));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Headers of a legitimate write from the page: own Origin, JSON and the key cookie. */
async function writer(t: Parameters<typeof makeHome>[0], extra: { lang?: 'es' | 'en' } = {}) {
  const ctx = await serve(t, extra);
  const landing = await get(ctx.port, `/?k=${ctx.server.token}`);
  assert.equal(landing.status, 303);
  assert.equal(landing.headers.location, '/');
  const setCookie = String((landing.headers['set-cookie'] as string[])[0]);
  assert.match(setCookie, /; Path=\/; HttpOnly; SameSite=Strict$/);
  const headers = { Origin: `http://127.0.0.1:${ctx.port}`, 'Content-Type': 'application/json', Cookie: setCookie.split(';')[0] };
  return { ...ctx, headers };
}

test('the key link sets an HttpOnly SameSite=Strict cookie; a wrong key sets nothing', async (t) => {
  const { port, server, headers } = await writer(t);
  assert.equal(server.writeUrl, `${server.url}?k=${server.token}`);
  const wrong = await get(port, '/?k=nope');
  assert.equal(wrong.status, 303);
  assert.equal(wrong.headers['set-cookie'], undefined);
  assert.equal(JSON.parse((await get(port, '/api/session')).body).canWrite, false);
  assert.equal(JSON.parse(await getWithCookie(port, '/api/session', headers.Cookie)).canWrite, true);
});

test('create, approve and discard from the web: one commit each, approvedVia web', async (t) => {
  const { home, port, headers } = await writer(t);
  const before = commitCount(home);
  const created = await post(port, '/api/projects/demo/tasks', { title: 'Desde la web', body: 'Detalle', priority: 'high' }, headers);
  assert.equal(created.status, 201, created.body);
  const task = JSON.parse(created.body).task;
  assert.equal(task.status, 'todo');
  assert.equal(task.origin, 'user');
  assert.equal(task.priority, 'high');
  assert.deepEqual(JSON.parse(created.body).warnings, []);

  const proposal = createTask(home, 'demo', { title: 'Idea de Claude' }, 'mcp').task;
  const approved = await post(port, `/api/projects/demo/tasks/${proposal.id}/approve`, { expectedUpdated: proposal.updated }, headers);
  assert.equal(approved.status, 200, approved.body);
  assert.equal(JSON.parse(approved.body).task.status, 'todo');
  assert.equal(JSON.parse(approved.body).task.approvedVia, 'web');

  const fresh = JSON.parse((await get(port, `/api/projects/demo/tasks/${task.id}`)).body);
  const discarded = await post(port, `/api/projects/demo/tasks/${task.id}/discard`, { expectedUpdated: fresh.updated }, headers);
  assert.equal(discarded.status, 200, discarded.body);
  assert.equal(JSON.parse(discarded.body).task.status, 'discarded');

  // create (web) + create (mcp, above) + approve + discard
  assert.equal(commitCount(home), before + 4);
  assert.equal(gitOut(home, 'log', '-3', '--format=%s'), 'wf: set-status WF-1 todo->discarded\nwf: set-status WF-2 proposed->todo\nwf: create WF-2');
});

test('writes without the key, from another Origin or without JSON are rejected with no effect', async (t) => {
  const { home, port, headers } = await writer(t, { lang: 'es' });
  const proposal = createTask(home, 'demo', { title: 'Intacta' }, 'mcp').task;
  const files = tree(home);
  const commits = commitCount(home);
  const approve = `/api/projects/demo/tasks/${proposal.id}/approve`;
  const body = { expectedUpdated: proposal.updated };
  const cases: Array<[string, Record<string, string>, number]> = [
    ['no key', { ...headers, Cookie: '' }, 401],
    ['wrong key', { ...headers, Cookie: `wayfinder_${port}=${'0'.repeat(48)}` }, 401],
    ['foreign Origin', { ...headers, Origin: 'http://evil.example.com' }, 403],
    ['other local port', { ...headers, Origin: 'http://127.0.0.1:1' }, 403],
    ['no Origin', { 'Content-Type': headers['Content-Type'], Cookie: headers.Cookie }, 403],
    ['text/plain', { ...headers, 'Content-Type': 'text/plain' }, 415],
    ['form', { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, 415],
    ['foreign Host', { ...headers, Host: 'evil.example.com' }, 403],
  ];
  for (const [name, h, status] of cases) {
    assert.equal((await post(port, approve, body, h)).status, status, name);
  }
  assert.match(JSON.parse((await post(port, approve, body, { ...headers, Cookie: '' })).body).error, /clave de escritura/);
  assert.equal((await post(port, approve, '{not json', headers)).status, 400);
  assert.equal((await post(port, approve, {}, headers)).status, 400, 'expectedUpdated is required');
  assert.equal((await post(port, '/api/projects/demo/tasks', 'x'.repeat(300 * 1024), headers)).status, 413);
  assert.equal((await post(port, `/api/projects/demo/tasks/${proposal.id}/start`, body, headers)).status, 405);
  assert.deepEqual(tree(home), files);
  assert.equal(commitCount(home), commits);
});

test('stale or invalid state answers 409; invalid input names the field', async (t) => {
  const { home, port, headers } = await writer(t, { lang: 'es' });
  const proposal = createTask(home, 'demo', { title: 'Cambiante' }, 'mcp').task;
  const stale = await post(port, `/api/projects/demo/tasks/${proposal.id}/approve`, { expectedUpdated: '2000-01-01T00:00:00' }, headers);
  assert.equal(stale.status, 409);
  assert.match(JSON.parse(stale.body).error, /cambió/);
  const todo = createTask(home, 'demo', { title: 'Ya aprobada' }, 'web').task;
  assert.equal((await post(port, `/api/projects/demo/tasks/${todo.id}/approve`, { expectedUpdated: todo.updated }, headers)).status, 409);
  assert.equal((await post(port, '/api/projects/demo/tasks/WF-99/approve', { expectedUpdated: 'x' }, headers)).status, 404);
  assert.equal((await post(port, '/api/projects/nope/tasks', { title: 'x' }, headers)).status, 404);

  const empty = await post(port, '/api/projects/demo/tasks', { title: '   ' }, headers);
  assert.equal(empty.status, 400);
  assert.equal(JSON.parse(empty.body).field, 'title');
  const secretBody = await post(port, '/api/projects/demo/tasks', { title: 'Bien', body: 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789' }, headers);
  assert.equal(secretBody.status, 400);
  assert.equal(JSON.parse(secretBody.body).field, 'body');
  assert.equal(JSON.parse((await post(port, '/api/projects/demo/tasks', { title: 'Bien', priority: 'urgent' }, headers)).body).field, 'priority');
});

test('git missing: the write is kept and answers 201 with a visible warning', async (t) => {
  const { port, headers } = await writer(t, { lang: 'es' });
  const restore = setGitRunner(() => ({ ok: false, missing: true, stdout: '', stderr: 'spawn git ENOENT' }));
  t.after(restore);
  const res = await post(port, '/api/projects/demo/tasks', { title: 'Sin git' }, headers);
  assert.equal(res.status, 201);
  const { task, warnings } = JSON.parse(res.body);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /git/i);
  assert.equal(JSON.parse((await get(port, `/api/projects/demo/tasks/${task.id}`)).body).title, 'Sin git');
});

test('the task detail includes its history: the creation entry as data, the rest rendered safely', async (t) => {
  const { home, port } = await serve(t);
  createTask(home, 'demo', { title: 'Con historial', body: 'Descripción' }, 'web');
  logProgress(home, 'demo', 'WF-1', 'Avanzamos.\n<script>alert(1)</script> [x](javascript:alert(2))\n# no es cabecera', { next: 'seguir' }, () => new Date('2026-10-22T13:40:00'));
  const task = JSON.parse((await get(port, '/api/projects/demo/tasks/WF-1')).body);
  assert.equal(task.html.includes('Historial'), false, 'the description html does not contain the history');
  assert.equal(task.history.length, 2);
  assert.deepEqual({ ...task.history[0], date: 'd', time: 't' }, { n: 1, date: 'd', time: 't', created: true });
  const entry = task.history[1];
  assert.equal(entry.n, 2);
  assert.equal(entry.date, '2026-10-22');
  assert.equal(entry.time, '13:40');
  assert.doesNotMatch(entry.html, /<script|href="javascript:|<h1/i);
  assert.match(entry.html, /# no es cabecera/);
  assert.match(entry.html, /Next: seguir/);
});

test('errors: list and detail are read-only, rendered safely, and the task lists its errors', async (t) => {
  const { home, port, headers } = await writer(t);
  assert.deepEqual(JSON.parse((await get(port, '/api/projects/demo/errors')).body), { errors: [], unreadable: [] });
  createTask(home, 'demo', { title: 'Build' }, 'web');
  const clock = () => new Date('2026-10-23T10:00:00');
  createError(home, 'demo', {
    title: 'Falla <img src=x onerror=alert(1)>',
    task: 'WF-1',
    context: 'Al compilar\n<script>alert(1)</script> [x](javascript:alert(2))',
    output: '# línea con almohadilla\n<b>no es html</b>',
  }, clock);
  noteError(home, 'demo', 'ERR-1', 'Recurrencia', clock);

  const list = JSON.parse((await get(port, '/api/projects/demo/errors')).body);
  assert.deepEqual(list.errors.map((e: { id: string; status: string; task: string }) => [e.id, e.status, e.task]), [['ERR-1', 'open', 'WF-1']]);

  const detail = JSON.parse((await get(port, '/api/projects/demo/errors/ERR-1')).body);
  assert.equal(detail.taskTitle, 'Build');
  const field = (key: string) => detail.fields.find((f: { key: string }) => f.key === key);
  assert.doesNotMatch(field('context').html, /<script|href="javascript:/i);
  assert.equal(field('output').text, '# línea con almohadilla\n<b>no es html</b>');
  assert.equal(field('cause').html, '');
  assert.equal(detail.history.length, 2);
  assert.match(detail.history[1].html, /Recurrencia/);

  const task = JSON.parse((await get(port, '/api/projects/demo/tasks/WF-1')).body);
  assert.deepEqual(task.errors, [{ id: 'ERR-1', title: 'Falla <img src=x onerror=alert(1)>', status: 'open' }]);

  for (const path of ['/api/projects/demo/errors/ERR-9', '/api/projects/demo/errors/WF-1', '/api/projects/demo/errors/..%2Fx', '/api/projects/nope/errors']) {
    assert.equal((await get(port, path)).status, 404, path);
  }
  const files = tree(home);
  assert.equal((await post(port, '/api/projects/demo/errors', { title: 'x' }, headers)).status, 405);
  assert.equal((await post(port, '/api/projects/demo/errors/ERR-1/resolve', {}, headers)).status, 405);
  assert.deepEqual(tree(home), files);
});
