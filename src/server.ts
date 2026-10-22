import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dictionaries, t, translateReason, type Lang } from './i18n/index.ts';
import { createRenderer } from './markdown.ts';
import { WayfinderError } from './store/errors.ts';
import { modifiedOutside } from './store/git.ts';
import { isWithin, projectDir, safeJoin, SLUG_RE } from './store/paths.ts';
import { listProjects, requireProject } from './store/project.ts';
import { findSecrets } from './store/secrets.ts';
import { createTask, listTasks, readTask, setStatus, type Task, type WriteResult } from './store/tasks.ts';

export interface ServeOptions {
  home: string;
  lang: Lang;
  host?: string;
  port?: number;
  /** Port published on the host when running in Docker (it differs from the container port). */
  publicPort?: number;
  /** Poll file mtimes instead of fs.watch (Docker bind mounts, network drives). */
  poll?: boolean;
  /** Folder with index.html, app.js and styles.css. */
  webDir: string;
}

export interface RunningServer {
  url: string;
  /** `url` plus the per-start key; opening it enables writes in that browser. */
  writeUrl: string;
  port: number;
  token: string;
  close: () => Promise<void>;
}

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const STATIC: Record<string, string> = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/app.js': 'app.js',
  '/styles.css': 'styles.css',
};
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
const ASSET_NAME = /^[\w.-]+\.(png|jpe?g|gif|webp)$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Not Astro's 4321 or other common dev-server ports. */
export const DEFAULT_PORT = 4747;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const MAX_JSON = 256 * 1024;
/** Store errors caused by the current state of the task rather than by the request. */
const CONFLICT_KEYS = new Set(['store.conflict', 'store.invalidTransition']);
const NOT_FOUND_KEYS = new Set(['store.projectNotFound', 'store.taskNotFound']);

function taskMeta(home: string, task: Task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    origin: task.origin,
    created: task.created,
    updated: task.updated,
    plan: task.plan,
    approvedVia: task.approvedVia ?? null,
    riskAcknowledged: task.riskAcknowledged ?? false,
    modifiedOutside: modifiedOutside(home, task.file),
  };
}

export function startServer(options: ServeOptions): Promise<RunningServer> {
  const { home, lang, webDir } = options;
  const host = options.host ?? '127.0.0.1';
  const token = randomBytes(24).toString('hex');
  const clients = new Set<ServerResponse>();
  let boundPort = 0;

  const allowedHosts = () => {
    const ports = new Set([boundPort, options.publicPort].filter((p): p is number => typeof p === 'number' && p > 0));
    const names = new Set(['127.0.0.1', 'localhost', '[::1]', ...(LOOPBACK.has(host) || host === '0.0.0.0' ? [] : [host])]);
    const out = new Set<string>();
    for (const n of names) for (const p of ports) out.add(`${n}:${p}`.toLowerCase());
    return out;
  };

  const send = (res: ServerResponse, status: number, body: string | Buffer, type: string, extra: Record<string, string> = {}) => {
    res.writeHead(status, {
      ...extra,
      'Content-Type': type,
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
  const json = (res: ServerResponse, status: number, value: unknown) => send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
  const notFound = (res: ServerResponse) => json(res, 404, { error: t(lang, 'web.notFound') });

  // Writes need the per-start key. Opening `/?k=<key>` (printed by `serve`) stores it in an
  // HttpOnly, SameSite=Strict cookie; the name carries the port because cookies ignore ports.
  const cookieName = () => `wayfinder_${options.publicPort ?? boundPort}`;
  const tokenBuffer = Buffer.from(token);
  const sameToken = (value: string | undefined) => {
    const candidate = Buffer.from(value ?? '');
    return candidate.length === tokenBuffer.length && timingSafeEqual(candidate, tokenBuffer);
  };
  const cookieToken = (req: IncomingMessage) => {
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === cookieName()) return rest.join('=');
    }
    return undefined;
  };
  const canWrite = (req: IncomingMessage) => sameToken(cookieToken(req));

  const renderFor = (slug: string) => createRenderer(`/api/projects/${encodeURIComponent(slug)}/assets`);

  function handleApi(req: IncomingMessage, res: ServerResponse, parts: string[]): void {
    if (parts[0] === 'session' && parts.length === 1) return json(res, 200, { canWrite: canWrite(req) });
    if (parts[0] === 'i18n' && parts.length === 1) {
      const messages = Object.fromEntries(Object.entries(dictionaries[lang]).filter(([k]) => k.startsWith('web.') || k.startsWith('status.')));
      return json(res, 200, { lang, messages });
    }
    if (parts[0] !== 'projects') return notFound(res);
    if (parts.length === 1) {
      return json(res, 200, {
        projects: listProjects(home).map((p) => {
          const { tasks, unreadable } = listTasks(home, p.slug);
          const counts: Record<string, number> = {};
          for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
          return { slug: p.slug, name: p.name, idPrefix: p.idPrefix, counts, unreadable: unreadable.length };
        }),
      });
    }
    const slug = parts[1];
    if (!SLUG_RE.test(slug)) return notFound(res);
    const project = requireProject(home, slug);
    const md = renderFor(slug);
    if (parts.length === 2) {
      return json(res, 200, { slug, name: project.name, idPrefix: project.idPrefix, repo: project.repo ?? null, html: md.render(project.body) });
    }
    if (parts[2] === 'tasks' && parts.length === 3) {
      const { tasks, unreadable } = listTasks(home, slug);
      return json(res, 200, {
        tasks: tasks.map((x) => taskMeta(home, x)),
        unreadable: unreadable.map((u) => ({ file: u.file, reason: translateReason(lang, u.reason) })),
      });
    }
    if (parts[2] === 'tasks' && parts.length === 4) {
      const task = readTask(home, slug, parts[3]);
      return json(res, 200, { ...taskMeta(home, task), html: md.render(task.body) });
    }
    if (parts[2] === 'log' && parts.length === 3) {
      const dir = safeJoin(projectDir(home, slug), 'log');
      const days = existsSync(dir) ? readdirSync(dir).filter((n) => DAY_RE.test(n.replace(/\.md$/, ''))).map((n) => n.replace(/\.md$/, '')).sort().reverse() : [];
      return json(res, 200, { days });
    }
    if (parts[2] === 'log' && parts.length === 4 && DAY_RE.test(parts[3])) {
      const file = safeJoin(projectDir(home, slug), 'log', `${parts[3]}.md`);
      if (!existsSync(file)) return notFound(res);
      // The day file starts with "# YYYY-MM-DD"; the page renders its own heading.
      const text = readFileSync(file, 'utf8').replace(/^#\s+\d{4}-\d{2}-\d{2}\s*\n/, '');
      return json(res, 200, { day: parts[3], html: md.render(text) });
    }
    if (parts[2] === 'assets' && parts.length === 3) {
      const dir = safeJoin(projectDir(home, slug), 'assets');
      const names = existsSync(dir) ? readdirSync(dir).filter((n) => ASSET_NAME.test(n)).sort().reverse() : [];
      // The description (alt) of a capture lives in the Markdown link that embeds it.
      const described = new Map<string, { alt: string; taskId: string | null }>();
      const collect = (markdown: string, taskId: string | null) => {
        for (const m of markdown.matchAll(/!\[([^\]]*)\]\((?:\.\.\/)?assets\/([\w.-]+)\)/g)) {
          if (!described.has(m[2])) described.set(m[2], { alt: m[1], taskId });
        }
      };
      collect(project.body, null);
      for (const task of listTasks(home, slug).tasks) collect(task.body, task.id);
      return json(res, 200, { assets: names.map((name) => ({ name, alt: described.get(name)?.alt ?? '', taskId: described.get(name)?.taskId ?? null })) });
    }
    return notFound(res);
  }

  function serveAsset(res: ServerResponse, slug: string, name: string): void {
    if (!SLUG_RE.test(slug) || !ASSET_NAME.test(name)) return notFound(res);
    const dir = safeJoin(projectDir(home, slug), 'assets');
    const file = safeJoin(dir, name);
    if (!existsSync(file) || !isWithin(dir, file) || !statSync(file).isFile()) return notFound(res);
    send(res, 200, readFileSync(file), MIME[extname(name).toLowerCase()] ?? 'application/octet-stream');
  }

  function handle(req: IncomingMessage, res: ServerResponse): void {
    const hostHeader = (req.headers.host ?? '').toLowerCase();
    if (!allowedHosts().has(hostHeader)) return json(res, 403, { error: t(lang, 'web.forbiddenHost') });
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') return json(res, 405, { error: t(lang, 'web.methodNotAllowed') });

    let pathname: string;
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return notFound(res);
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return notFound(res);
    if (req.method === 'POST') return handleWrite(req, res, pathname.split('/').filter(Boolean));

    // `/?k=<key>`: remember the key in this browser and drop it from the address bar.
    if ((pathname === '/' || pathname === '/index.html') && url.searchParams.has('k')) {
      const headers: Record<string, string> = { Location: '/' };
      if (sameToken(url.searchParams.get('k') ?? '')) headers['Set-Cookie'] = `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict`;
      return send(res, 303, '', 'text/plain; charset=utf-8', headers);
    }

    const file = STATIC[pathname];
    if (file) {
      const full = join(webDir, file);
      if (!existsSync(full)) return notFound(res);
      return send(res, 200, readFileSync(full), MIME[extname(file)]);
    }
    if (pathname === '/api/events') return openEvents(req, res);

    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'api') return notFound(res);
    if (parts[1] === 'projects' && parts[3] === 'assets' && parts.length === 5) return serveAsset(res, parts[2], parts[4]);
    try {
      handleApi(req, res, parts.slice(1));
    } catch (error) {
      fail(res, error);
    }
  }

  function fail(res: ServerResponse, error: unknown, field?: string): void {
    if (error instanceof WayfinderError) {
      const status = NOT_FOUND_KEYS.has(error.key) ? 404 : CONFLICT_KEYS.has(error.key) ? 409 : 400;
      return json(res, status, { error: t(lang, error.key, error.vars), ...(field ? { field } : {}) });
    }
    json(res, 500, { error: t(lang, 'web.serverError') });
  }

  // ---------- writes ----------
  // CSRF and DNS rebinding: Host is already allow-listed; a write also needs our own Origin,
  // a JSON body (cross-site JSON needs a CORS preflight, which is never granted) and the key.
  function handleWrite(req: IncomingMessage, res: ServerResponse, parts: string[]): void {
    const route = writeRoute(parts);
    if (!route) return json(res, 405, { error: t(lang, 'web.methodNotAllowed') });
    if (req.headers.origin !== `http://${req.headers.host}`) return json(res, 403, { error: t(lang, 'web.forbiddenOrigin') });
    if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')) return json(res, 415, { error: t(lang, 'web.jsonOnly') });
    if (!canWrite(req)) return json(res, 401, { error: t(lang, 'web.needsKey') });

    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_JSON) chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > MAX_JSON) return json(res, 413, { error: t(lang, 'web.tooLarge') });
      let input: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        input = parsed as Record<string, unknown>;
      } catch {
        return json(res, 400, { error: t(lang, 'web.badJson') });
      }
      const str = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined);
      try {
        let result: WriteResult;
        if (route.action === 'create') {
          result = createTask(home, route.slug, { title: str('title') ?? '', body: str('body') ?? '', priority: str('priority') }, 'web');
        } else {
          const expectedUpdated = str('expectedUpdated');
          if (!expectedUpdated) return json(res, 400, { error: t(lang, 'web.badJson') });
          result = setStatus(home, route.slug, route.id, route.action === 'approve' ? 'todo' : 'discarded', 'web', { expectedUpdated });
        }
        json(res, route.action === 'create' ? 201 : 200, {
          task: taskMeta(home, result.task),
          warnings: result.warnings.map((w) => t(lang, w.key, w.vars)),
        });
      } catch (error) {
        fail(res, error, route.action === 'create' ? formField(error, str('title') ?? '') : undefined);
      }
    });
  }

  /** The store says what failed, not where: name the form field so the page can mark it. */
  function formField(error: unknown, title: string): string | undefined {
    if (!(error instanceof WayfinderError)) return undefined;
    if (error.key === 'store.secretRejected') return findSecrets(title).length > 0 ? 'title' : 'body';
    return ({ 'store.invalidTitle': 'title', 'store.bodyTooLong': 'body', 'store.invalidPriority': 'priority' } as Record<string, string>)[error.key];
  }

  function writeRoute(parts: string[]): { action: 'create' | 'approve' | 'discard'; slug: string; id: string } | null {
    // /api/projects/:slug/tasks and /api/projects/:slug/tasks/:id/(approve|discard)
    if (parts[0] !== 'api' || parts[1] !== 'projects' || parts[3] !== 'tasks' || !SLUG_RE.test(parts[2] ?? '')) return null;
    if (parts.length === 4) return { action: 'create', slug: parts[2], id: '' };
    if (parts.length === 6 && (parts[5] === 'approve' || parts[5] === 'discard')) return { action: parts[5], slug: parts[2], id: parts[4] };
    return null;
  }

  function openEvents(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    });
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  // Change detection: fs.watch with debounce, or mtime polling (Docker, network drives).
  let debounce: NodeJS.Timeout | undefined;
  const notify = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      for (const c of clients) c.write(`event: change\ndata: ${Date.now()}\n\n`);
    }, 150);
  };
  const projectsDir = join(home, 'projects');
  let watcher: FSWatcher | undefined;
  let poller: NodeJS.Timeout | undefined;
  const snapshot = () => {
    if (!existsSync(projectsDir)) return '';
    const entries = readdirSync(projectsDir, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => {
        const full = join(e.parentPath, e.name);
        try {
          return `${full}:${statSync(full).mtimeMs}`;
        } catch {
          return full;
        }
      })
      .sort()
      .join('\n');
  };
  if (options.poll) {
    let last = snapshot();
    poller = setInterval(() => {
      const next = snapshot();
      if (next !== last) {
        last = next;
        notify();
      }
    }, 1500);
  } else if (existsSync(projectsDir)) {
    watcher = watch(projectsDir, { recursive: true }, notify);
    watcher.on('error', () => undefined);
  }
  const heartbeat = setInterval(() => {
    for (const c of clients) c.write(': ping\n\n');
  }, 25_000);

  const server = createServer(handle);
  const port = options.port ?? DEFAULT_PORT;
  const stopWatching = () => {
    clearInterval(heartbeat);
    clearInterval(poller);
    clearTimeout(debounce);
    watcher?.close();
  };
  return new Promise((resolvePromise, reject) => {
    const failed = (error: unknown) => {
      stopWatching();
      server.close();
      reject((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE' ? new WayfinderError('serve.portInUse', { port }) : error);
    };
    server.once('error', failed);
    // Windows lets 127.0.0.1:<port> coexist with another app bound to 0.0.0.0:<port>, and the
    // browser would then reach whichever answers. Refuse a port where something already listens.
    portAnswers(port).then((busy) => {
      if (busy) return failed(new WayfinderError('serve.portInUse', { port }));
      server.listen(port, host, onListening);
    }, failed);
    function onListening() {
      const address = server.address();
      boundPort = typeof address === 'object' && address ? address.port : 0;
      const shownHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
      const url = `http://${shownHost}:${options.publicPort ?? boundPort}/`;
      resolvePromise({
        url,
        writeUrl: `${url}?k=${token}`,
        port: boundPort,
        token,
        close: () =>
          new Promise<void>((done) => {
            stopWatching();
            for (const c of clients) c.end();
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    }
  });
}

/** True when something accepts connections on 127.0.0.1:<port>. Port 0 means "any free port". */
function portAnswers(port: number): Promise<boolean> {
  if (port === 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    const done = (busy: boolean) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
