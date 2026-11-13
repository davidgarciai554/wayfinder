import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dictionaries, t, translateReason, type Lang, type MessageKey } from './i18n/index.ts';
import { createRenderer } from './markdown.ts';
import { WayfinderError } from './store/errors.ts';
import { isCreationEntry, parseEntries } from './store/history.ts';
import { modifiedOutside } from './store/git.ts';
import { ERROR_FIELDS, errorsForTask, listErrors, readError, unescapeField, type ErrorRecord } from './store/error-records.ts';
import { ERROR_ID_RE, isWithin, projectDir, safeJoin, SLUG_RE } from './store/paths.ts';
import { listProjects, requireProject } from './store/project.ts';
import { findSecrets } from './store/secrets.ts';
import type { Status } from './store/transitions.ts';
import { createTask, listTasks, readTask, reopenTarget, setStatus, type Task, type WriteResult } from './store/tasks.ts';

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
  /**
   * A second address of this machine (LAN or VPN) that also serves the board, on the same port and
   * with the same key. Used by `wf_web` ("abre Wayfinder") from the webHost option; never from the agent.
   */
  remoteHost?: string;
}

export interface RunningServer {
  url: string;
  /** `url` plus the per-start key; opening it enables writes in that browser. */
  writeUrl: string;
  /** The link with the key for other devices, when `remoteHost` is set. */
  remoteUrl: string | null;
  port: number;
  token: string;
  close: () => Promise<void>;
}

/** Why a request has no valid key: none, a key of an earlier start (another `gen`), or a wrong one. */
type KeyCheck = 'ok' | 'missing' | 'expired' | 'wrong';

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
const NOT_FOUND_KEYS = new Set(['store.projectNotFound', 'store.taskNotFound', 'store.errorNotFound']);

function errorMeta(error: ErrorRecord) {
  return { id: error.id, title: error.title, status: error.status, kind: error.kind, task: error.task, created: error.created, updated: error.updated };
}

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
    /** Where «Reabrir» would send a done or discarded task (todo or proposed); null otherwise. */
    reopensTo: reopenTarget(task),
  };
}

/** The web files: bundle dist/wayfinder.mjs → dist/web; sources src/*.ts → web/. */
export function webDir(): string {
  const bundled = fileURLToPath(new URL('./web', import.meta.url));
  return existsSync(join(bundled, 'index.html')) ? bundled : fileURLToPath(new URL('../web', import.meta.url));
}

/** IPv6 literals go in brackets inside a URL or a Host header. */
const hostPart = (h: string) => (h.includes(':') ? `[${h}]` : h);

/** The socket's own address, not the Host header (which the client chooses), says how it arrived. */
function viaLoopback(req: IncomingMessage): boolean {
  const address = req.socket.localAddress ?? '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function startServer(options: ServeOptions): Promise<RunningServer> {
  const { home, lang, webDir } = options;
  const host = options.host ?? '127.0.0.1';
  const remoteHost = options.remoteHost?.trim() || undefined;
  // `<gen>.<secret>`: a new key on every start invalidates the previous one, and the public `gen`
  // tells an old link (another start) from a wrong one without keeping any state.
  const gen = randomBytes(3).toString('hex');
  const token = `${gen}.${randomBytes(24).toString('hex')}`;
  const clients = new Set<ServerResponse>();
  let boundPort = 0;
  let remoteUrl: string | null = null;
  let localWriteUrl = '';

  const allowedHosts = () => {
    const ports = new Set([boundPort, options.publicPort].filter((p): p is number => typeof p === 'number' && p > 0));
    const own = LOOPBACK.has(host) || host === '0.0.0.0' ? [] : [hostPart(host)];
    const names = new Set(['127.0.0.1', 'localhost', '[::1]', ...own, ...(remoteHost ? [hostPart(remoteHost)] : [])]);
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
  // HttpOnly, SameSite=Lax cookie; the name carries the port because cookies ignore ports.
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
  const checkKey = (value: string | undefined): KeyCheck => {
    if (!value) return 'missing';
    if (sameToken(value)) return 'ok';
    const candidateGen = value.split('.')[0] ?? '';
    return /^[0-9a-f]{6}$/.test(candidateGen) && candidateGen !== gen ? 'expired' : 'wrong';
  };
  const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  /** Static page without JS: says why there is no access and what to do. */
  const accessPage = (res: ServerResponse, reason: Exclude<KeyCheck, 'ok'>) => {
    const title = escapeHtml(t(lang, 'web.access.title'));
    const message = escapeHtml(t(lang, `web.access.${reason}` as MessageKey));
    const html = `<!doctype html>\n<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/styles.css"></head><body><main class="access"><h1>${title}</h1><p role="alert">${message}</p></main></body></html>\n`;
    send(res, 401, html, 'text/html; charset=utf-8');
  };

  const renderFor = (slug: string) => createRenderer(`/api/projects/${encodeURIComponent(slug)}/assets`);

  function handleApi(req: IncomingMessage, res: ServerResponse, parts: string[]): void {
    if (parts[0] === 'session' && parts.length === 1) return json(res, 200, { canWrite: canWrite(req) });
    // The links with the key (write access on this PC, and access from other devices): only this
    // PC (loopback) can read them. The agent gets just the plain local URL, so the key never goes
    // through the conversation.
    if (parts[0] === 'share' && parts.length === 1) {
      if (!viaLoopback(req)) return notFound(res);
      // SEC-1: only this page's own fetch gets the keys. Browsers add Sec-Fetch-* and pages cannot
      // change them; a command-line client (an agent running curl) does not send them unless it
      // forges them on purpose, and the PreToolUse hook denies commands that try. Best effort, not
      // a boundary: anything on this PC can also read the data folder.
      const fromPage =
        req.headers['sec-fetch-site'] === 'same-origin' && req.headers['sec-fetch-mode'] === 'cors' && req.headers['sec-fetch-dest'] === 'empty';
      if (!fromPage) return json(res, 403, { error: t(lang, 'web.shareBrowserOnly') });
      return json(res, 200, { local: localWriteUrl, remote: remoteUrl });
    }
    if (parts[0] === 'i18n' && parts.length === 1) {
      const messages = Object.fromEntries(Object.entries(dictionaries[lang]).filter(([k]) => k.startsWith('web.') || k.startsWith('status.') || k.startsWith('errorKind.')));
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
      const history = parseEntries(task.history).map((e) =>
        isCreationEntry(e) ? { n: e.n, date: e.date, time: e.time, created: true } : { n: e.n, date: e.date, time: e.time, html: md.render(e.text) },
      );
      const errors = errorsForTask(home, slug, task.id).map((e) => ({ id: e.id, title: e.title, status: e.status, kind: e.kind }));
      return json(res, 200, { ...taskMeta(home, task), html: md.render(task.body), history, errors });
    }
    if (parts[2] === 'errors' && parts.length === 3) {
      const { errors, unreadable } = listErrors(home, slug);
      return json(res, 200, {
        errors: errors.map(errorMeta),
        unreadable: unreadable.map((u) => ({ file: u.file, reason: translateReason(lang, u.reason) })),
      });
    }
    if (parts[2] === 'errors' && parts.length === 4) {
      if (!ERROR_ID_RE.test(parts[3])) return notFound(res);
      const error = readError(home, slug, parts[3]);
      let taskTitle: string | null = null;
      try {
        taskTitle = readTask(home, slug, error.task).title;
      } catch {
        // The page shows the ID without a link when the task no longer exists.
      }
      const fields = ERROR_FIELDS.map(([key]) =>
        // The observed output is shown as plain text, exactly as written.
        key === 'output' ? { key, text: unescapeField(error.fields[key]) } : { key, html: error.fields[key] ? md.render(error.fields[key]) : '' },
      );
      const history = parseEntries(error.history).map((e) => ({ n: e.n, date: e.date, time: e.time, html: md.render(e.text) }));
      return json(res, 200, { ...errorMeta(error), taskTitle, causeKind: error.causeKind, files: error.files, fields, history });
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
    const page = pathname === '/' || pathname === '/index.html';

    // `/?k=<key>`: remember the key in this browser and drop it from the address bar. A key of an
    // earlier start, or a wrong one, gets a page that says so instead of a silent redirect.
    if (page && url.searchParams.has('k')) {
      const check = checkKey(url.searchParams.get('k') ?? '');
      if (check !== 'ok') return accessPage(res, check);
      // Lax, not Strict: a link opened from another site (a chat, the PC's page) is a cross-site
      // navigation, and Strict would drop the cookie on the redirect to `/`. Writes stay protected
      // by the Origin check, the JSON-only body and the key itself.
      return send(res, 303, '', 'text/plain; charset=utf-8', { Location: '/', 'Set-Cookie': `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax` });
    }
    // Outside loopback every route needs the key (reads included); only the stylesheet of the
    // access page is public. Loopback keeps anonymous reads, as before.
    if (!viaLoopback(req) && pathname !== '/styles.css') {
      const check = checkKey(cookieToken(req));
      if (check !== 'ok') {
        if (page) return accessPage(res, check);
        return json(res, 401, { error: t(lang, `web.access.${check}` as MessageKey), reason: check });
      }
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
          // Reopen: the store decides the target (todo, or proposed if nobody approved it) and
          // setStatus checks it again under the lock, with expectedUpdated against races.
          // A task that is not done or discarded has no target: never fall back to a status
          // (todo would approve a proposal).
          let to: Status | null = route.action === 'approve' ? 'todo' : 'discarded';
          if (route.action === 'reopen') {
            const current = readTask(home, route.slug, route.id);
            to = reopenTarget(current);
            if (!to) throw new WayfinderError('store.invalidTransition', { from: current.status, to: 'reopen', valid: '—' });
          }
          result = setStatus(home, route.slug, route.id, to, 'web', { expectedUpdated, note: route.action === 'reopen' ? str('note') : undefined });
        }
        json(res, route.action === 'create' ? 201 : 200, {
          task: taskMeta(home, result.task),
          warnings: result.warnings.map((w) => t(lang, w.key, w.vars)),
        });
      } catch (error) {
        fail(res, error, route.action === 'create' ? formField(error, str('title') ?? '') : route.action === 'reopen' ? noteField(error) : undefined);
      }
    });
  }

  /** The store says what failed, not where: name the form field so the page can mark it. */
  function formField(error: unknown, title: string): string | undefined {
    if (!(error instanceof WayfinderError)) return undefined;
    if (error.key === 'store.secretRejected') return findSecrets(title).length > 0 ? 'title' : 'body';
    return ({ 'store.invalidTitle': 'title', 'store.bodyTooLong': 'body', 'store.invalidPriority': 'priority' } as Record<string, string>)[error.key];
  }

  /** Reopen: errors about the reason point at the note field of the dialog. */
  function noteField(error: unknown): string | undefined {
    if (!(error instanceof WayfinderError)) return undefined;
    return ['store.noteRequired', 'store.secretRejected', 'store.logEntryTooLong'].includes(error.key) ? 'note' : undefined;
  }

  function writeRoute(parts: string[]): { action: 'create' | 'approve' | 'discard' | 'reopen'; slug: string; id: string } | null {
    // /api/projects/:slug/tasks and /api/projects/:slug/tasks/:id/(approve|discard|reopen)
    if (parts[0] !== 'api' || parts[1] !== 'projects' || parts[3] !== 'tasks' || !SLUG_RE.test(parts[2] ?? '')) return null;
    if (parts.length === 4) return { action: 'create', slug: parts[2], id: '' };
    if (parts.length === 6 && (parts[5] === 'approve' || parts[5] === 'discard' || parts[5] === 'reopen')) return { action: parts[5], slug: parts[2], id: parts[4] };
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
  const remote = remoteHost ? createServer(handle) : undefined;
  const port = options.port ?? DEFAULT_PORT;
  const stopWatching = () => {
    clearInterval(heartbeat);
    clearInterval(poller);
    clearTimeout(debounce);
    watcher?.close();
  };
  const closeServer = (s: ReturnType<typeof createServer>) =>
    new Promise<void>((done) => {
      if (!s.listening) return done();
      s.close(() => done());
      s.closeAllConnections();
    });
  return new Promise((resolvePromise, reject) => {
    const failed = (error: unknown) => {
      stopWatching();
      server.close();
      remote?.close();
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'EADDRINUSE') return reject(new WayfinderError('serve.portInUse', { port }));
      if (code === 'EADDRNOTAVAIL' && remoteHost) return reject(new WayfinderError('web.hostUnavailable', { host: remoteHost }));
      reject(error);
    };
    server.once('error', failed);
    remote?.once('error', failed);
    // Windows lets 127.0.0.1:<port> coexist with another app bound to 0.0.0.0:<port>, and the
    // browser would then reach whichever answers. Refuse a port where something already listens,
    // on loopback and on the second address.
    Promise.all([portAnswers(port), remoteHost ? portAnswers(port, remoteHost) : Promise.resolve(false)]).then(([busy, busyRemote]) => {
      if (busy || busyRemote) return failed(new WayfinderError('serve.portInUse', { port }));
      server.listen(port, host, onListening);
    }, failed);
    function onListening() {
      const address = server.address();
      boundPort = typeof address === 'object' && address ? address.port : 0;
      if (!remote || !remoteHost) return done();
      remote.listen(boundPort, remoteHost, () => {
        remoteUrl = `http://${hostPart(remoteHost)}:${boundPort}/?k=${token}`;
        done();
      });
    }
    function done() {
      const shownHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : hostPart(host);
      const url = `http://${shownHost}:${options.publicPort ?? boundPort}/`;
      localWriteUrl = `${url}?k=${token}`;
      resolvePromise({
        url,
        writeUrl: `${url}?k=${token}`,
        remoteUrl,
        port: boundPort,
        token,
        close: async () => {
          stopWatching();
          for (const c of clients) c.end();
          await Promise.all([closeServer(server), ...(remote ? [closeServer(remote)] : [])]);
        },
      });
    }
  });
}

/** True when something accepts connections on <address>:<port>. Port 0 means "any free port". */
function portAnswers(port: number, address = '127.0.0.1'): Promise<boolean> {
  if (port === 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = connect({ host: address, port });
    const done = (busy: boolean) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
