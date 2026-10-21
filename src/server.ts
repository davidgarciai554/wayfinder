import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { dictionaries, t, translateReason, type Lang } from './i18n/index.ts';
import { createRenderer } from './markdown.ts';
import { WayfinderError } from './store/errors.ts';
import { modifiedOutside } from './store/git.ts';
import { isWithin, projectDir, safeJoin, SLUG_RE } from './store/paths.ts';
import { listProjects, requireProject } from './store/project.ts';
import { listTasks, readTask, type Task } from './store/tasks.ts';

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
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

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

  const send = (res: ServerResponse, status: number, body: string | Buffer, type: string) => {
    res.writeHead(status, {
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

  const renderFor = (slug: string) => createRenderer(`/api/projects/${encodeURIComponent(slug)}/assets`);

  function handleApi(res: ServerResponse, parts: string[]): void {
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
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: t(lang, 'web.methodNotAllowed') });

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      return notFound(res);
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return notFound(res);

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
      handleApi(res, parts.slice(1));
    } catch (error) {
      if (error instanceof WayfinderError) {
        const status = error.key === 'store.projectNotFound' || error.key === 'store.taskNotFound' ? 404 : 400;
        return json(res, status, { error: t(lang, error.key, error.vars) });
      }
      json(res, 500, { error: t(lang, 'web.serverError') });
    }
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
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 4321, host, () => {
      const address = server.address();
      boundPort = typeof address === 'object' && address ? address.port : 0;
      const shownHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
      resolvePromise({
        url: `http://${shownHost}:${options.publicPort ?? boundPort}/`,
        port: boundPort,
        token,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(heartbeat);
            clearInterval(poller);
            clearTimeout(debounce);
            watcher?.close();
            for (const c of clients) c.end();
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}
