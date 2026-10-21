import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type RunningServer } from '../src/server.ts';
import { createTask } from '../src/store/tasks.ts';
import { makeHome, makeProject } from './helpers.ts';

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
