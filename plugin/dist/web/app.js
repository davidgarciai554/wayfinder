// Wayfinder web board (read-only, increment 4). Design: docs/design/DESIGN.md.
// Everything that comes from data is written with textContent; only Markdown rendered and
// sanitised by the server (markdown-it, html: false) is inserted as HTML.

const WIDE = window.matchMedia('(min-width: 1100px)');
const DONE_LIMIT = 10;
const LOG_PAGE = 7;
const STATUS_ORDER = ['proposed', 'todo', 'in-progress', 'done'];

let messages = {};
let lang = 'es';
let projects = [];
let view = null; // { slug, page, id }
let showAllDone = false;
let logShown = LOG_PAGE;
let refreshTimer;
let pendingChanges = 0;
let returnFocusTo = null;

const $ = (id) => document.getElementById(id);
const main = $('main');

function t(key, vars = {}) {
  const template = messages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child);
  return node;
}

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(`wayfinder.${key}`);
    return v === null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(`wayfinder.${key}`, String(value));
  } catch {
    // Storage may be unavailable (private mode); the preference simply is not kept.
  }
}

async function api(path) {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.error || t('web.error'));
    error.status = res.status;
    throw error;
  }
  return body;
}

// ---------- dates ----------
function parseDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
function relative(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return t('web.time.now');
  if (minutes < 60) return t('web.time.minutes', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('web.time.hours', { n: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return t('web.time.yesterday');
  return t('web.time.days', { n: days });
}
function exact(iso) {
  const d = parseDate(iso);
  if (!d) return iso || '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function timeEl(iso) {
  return el('time', { datetime: iso, title: exact(iso), text: relative(iso) });
}

// ---------- routing ----------
const PAGES = ['board', 'task', 'log', 'assets', 'project'];
function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [slug, page = 'board', id] = parts;
  return { slug: slug || null, page: PAGES.includes(page) ? page : 'board', id: id || null };
}
function href(slug, page = 'board', id) {
  return `#/${encodeURIComponent(slug)}/${page}${id ? `/${encodeURIComponent(id)}` : ''}`;
}

// ---------- chrome ----------
function renderChrome() {
  const picker = $('project-picker');
  const select = $('project-select');
  const tabs = $('tabs');
  const hasProject = Boolean(view.slug);
  picker.hidden = projects.length === 0;
  select.replaceChildren(...projects.map((p) => el('option', { value: p.slug, text: p.name, selected: p.slug === view.slug })));
  if (!hasProject) select.prepend(el('option', { value: '', text: t('web.chooseProject'), selected: true }));
  tabs.hidden = !hasProject;
  tabs.setAttribute('aria-label', t('web.views'));
  if (!hasProject) return;
  const current = view.page === 'task' ? 'board' : view.page;
  tabs.replaceChildren(
    ...['board', 'log', 'assets', 'project'].map((page) =>
      el('a', { href: href(view.slug, page), 'aria-current': page === current ? 'page' : null, text: t(`web.tab.${page}`) }),
    ),
  );
}

function setLive(text, state = 'online') {
  $('live-text').textContent = text;
  $('live-dot').dataset.state = state;
}

function statusLabel(status) {
  return t(`web.status.${status}`);
}

function loading() {
  main.replaceChildren(el('p', { class: 'status-text', role: 'status', text: t('web.loading') }));
}

function failure(error, retry) {
  main.replaceChildren(
    el('div', { class: 'notice', role: 'alert' },
      el('p', { text: error.message || t('web.error') }),
      el('button', { type: 'button', class: 'button', text: t('web.retry'), onclick: retry }),
    ),
  );
}

// ---------- board ----------
function tagsFor(task) {
  const tags = [];
  if (task.status === 'proposed') tags.push(el('span', { class: 'tag s-proposed', text: t('web.flag.unapproved') }));
  if (task.approvedVia === 'chat') tags.push(el('span', { class: 'tag f-chat', text: t('web.flag.chat') }));
  if (task.riskAcknowledged) {
    tags.push(el('span', { class: 'tag f-risk' }, warningIcon(), t('web.flag.risk')));
  }
  if (task.modifiedOutside) tags.push(el('span', { class: 'tag f-outside', text: t('web.flag.outside') }));
  return tags;
}

function icon(size, paths) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) {
    svg.setAttribute(k, String(v));
  }
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
const warningIcon = () => icon(14, ['M12 3 2 21h20L12 3z', 'M12 10v5', 'M12 18h.01']);
const closeIcon = () => icon(18, ['M6 6l12 12', 'M18 6 6 18']);

function card(task, selectedId) {
  const tags = tagsFor(task);
  return el('li', { class: 'card', 'data-status': task.status, 'aria-current': task.id === selectedId ? 'true' : null },
    el('div', { class: 'card-meta' },
      el('span', { text: `${task.id} · ${t(`web.priority.${task.priority}`)}` }),
      timeEl(task.updated),
    ),
    el('a', { class: 'card-title', href: href(view.slug, 'task', task.id), 'data-focus': `task:${task.id}`, text: task.title }),
    tags.length ? el('div', { class: 'tags' }, tags) : null,
  );
}

function column(id, title, tasks, selectedId, extra) {
  const headingId = `col-${id}`;
  return el('section', { class: 'column', 'aria-labelledby': headingId, id: `column-${id}` },
    el('h2', { id: headingId }, el('span', { text: title }), el('span', { class: 'count', text: String(tasks.length) })),
    el('ul', { class: 'cards' },
      tasks.length ? tasks.map((x) => card(x, selectedId)) : el('li', { class: 'none', text: t('web.none') }),
    ),
    extra,
  );
}

async function renderBoard() {
  const project = projects.find((p) => p.slug === view.slug);
  if (!project) return renderNotFound();
  const showDiscarded = readPref('showDiscarded', false);
  const data = await api(`/api/projects/${encodeURIComponent(view.slug)}/tasks`);
  const byStatus = (s) => data.tasks.filter((x) => x.status === s);
  // Most recent first; equal timestamps fall back to the higher ID (created later).
  const idNumber = (id) => Number(id.split('-')[1]) || 0;
  const recentFirst = (a, b) => (b.updated || '').localeCompare(a.updated || '') || idNumber(b.id) - idNumber(a.id);
  const done = byStatus('done').sort(recentFirst);
  const doneShown = showAllDone ? done : done.slice(0, DONE_LIMIT);
  const selectedId = view.page === 'task' ? view.id : null;

  const columns = [
    column('proposed', t('web.column.proposed'), byStatus('proposed'), selectedId),
    column('todo', t('web.column.todo'), byStatus('todo'), selectedId),
    column('in-progress', t('web.column.in-progress'), byStatus('in-progress'), selectedId),
    column('done', t('web.column.done'), doneShown, selectedId,
      done.length > DONE_LIMIT && !showAllDone
        ? el('button', { type: 'button', class: 'button button-quiet', 'data-focus': 'show-all-done', text: t('web.showAllDone', { n: done.length }), onclick: () => { showAllDone = true; render({ keepFocus: true }); } })
        : null),
  ];
  if (showDiscarded) columns.push(column('discarded', t('web.column.discarded'), byStatus('discarded').sort(recentFirst), selectedId));

  // Jump links for the stacked (compact) layout. They move focus instead of changing the hash,
  // which belongs to the router.
  const jumpTo = (event, status) => {
    event.preventDefault();
    const heading = $(`col-${status}`);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  };
  const totals = { proposed: byStatus('proposed').length, todo: byStatus('todo').length, 'in-progress': byStatus('in-progress').length, done: done.length };
  const jump = el('nav', { class: 'jump', 'aria-label': t('web.jumpTo') },
    STATUS_ORDER.map((s) => el('a', { href: `#column-${s}`, onclick: (e) => jumpTo(e, s), text: `${t(`web.column.${s}`)} (${totals[s]})` })),
  );

  const unreadable = data.unreadable.length
    ? el('div', { class: 'notice', role: 'note' },
        el('strong', { text: t('web.unreadable', { n: data.unreadable.length }) }),
        el('ul', {}, data.unreadable.map((u) => el('li', {}, el('span', { class: 'mono', text: u.file }), ` · ${u.reason}`))))
    : null;

  const toggle = el('label', { class: 'checkbox' },
    el('input', { type: 'checkbox', checked: showDiscarded, 'data-focus': 'toggle-discarded', onchange: (e) => { writePref('showDiscarded', e.target.checked); render({ keepFocus: true }); } }),
    t('web.showDiscarded'),
  );

  const boardArea = el('div', { class: 'board-area' },
    el('div', { class: 'page-head' },
      el('div', {},
        el('h1', { text: project.name }),
        el('p', { class: 'mono muted', text: `${t('web.prefix')} ${project.idPrefix}` }),
      ),
      el('div', { class: 'toolbar' }, toggle),
    ),
    unreadable,
    data.tasks.length === 0 ? el('p', { class: 'empty', text: t('web.emptyBoard') }) : null,
    jump,
    el('div', { class: 'columns' }, columns),
  );

  const workspace = el('div', { class: 'workspace' }, boardArea);
  if (view.page === 'task' && WIDE.matches) workspace.append(await detailPanel(false));
  main.replaceChildren(workspace);
}

// ---------- task detail ----------
async function detailPanel(asPage) {
  let task;
  try {
    task = await api(`/api/projects/${encodeURIComponent(view.slug)}/tasks/${encodeURIComponent(view.id)}`);
  } catch (error) {
    return el('aside', { class: `detail${asPage ? ' detail-page' : ''}` },
      el('p', { role: 'alert', text: error.status === 404 ? t('web.taskNotFound', { id: view.id }) : error.message }),
      el('a', { href: href(view.slug), text: t('web.backToBoard') }));
  }
  const close = asPage
    ? el('a', { class: 'button', href: href(view.slug), text: `← ${t('web.backToBoard')}` })
    : el('a', { class: 'button icon-button', href: href(view.slug), 'aria-label': t('web.closeDetail'), title: t('web.closeDetail') }, closeIcon());
  const body = el('div', { class: 'prose' });
  if (task.html.trim()) body.innerHTML = task.html; // Sanitised by the server (markdown-it, html: false).
  else body.append(el('p', { class: 'muted', text: t('web.noDescription') }));
  const row = (label, value) => [el('dt', { text: label }), el('dd', {}, value)];
  return el('aside', { class: `detail${asPage ? ' detail-page' : ''}`, 'aria-labelledby': 'task-title' },
    el('div', { class: 'detail-top' }, el('span', { class: 'mono muted', text: task.id }), close),
    el('h1', { id: 'task-title', tabindex: '-1', text: task.title }),
    el('div', { class: 'tags' }, el('span', { class: `pill s-${task.status}`, text: statusLabel(task.status) }), tagsFor({ ...task, status: '' })),
    el('dl', { class: 'meta' },
      row(t('web.meta.priority'), t(`web.priority.${task.priority}`)),
      row(t('web.meta.origin'), t(`web.origin.${task.origin}`)),
      row(t('web.meta.plan'), task.plan ? el('span', { class: 'mono', text: task.plan }) : '—'),
      row(t('web.meta.created'), el('span', { class: 'mono', text: exact(task.created) })),
      row(t('web.meta.updated'), el('span', { class: 'mono', text: exact(task.updated) })),
    ),
    body,
  );
}

async function renderTaskPage() {
  main.replaceChildren(await detailPanel(true));
}

// ---------- log ----------
async function renderLog() {
  const { days } = await api(`/api/projects/${encodeURIComponent(view.slug)}/log`);
  const head = el('div', { class: 'page-head' }, el('h1', { text: t('web.tab.log') }));
  if (days.length === 0) return main.replaceChildren(head, el('p', { class: 'empty', text: t('web.noLog') }));
  const shown = days.slice(0, logShown);
  const entries = await Promise.all(shown.map((day) => api(`/api/projects/${encodeURIComponent(view.slug)}/log/${day}`)));
  const list = el('div', { class: 'days' },
    entries.map((entry) => {
      const prose = el('div', { class: 'prose' });
      prose.innerHTML = entry.html; // Sanitised by the server.
      return el('section', { class: 'day', 'aria-labelledby': `day-${entry.day}` }, el('h2', { id: `day-${entry.day}`, text: entry.day }), prose);
    }),
  );
  const more = days.length > logShown
    ? el('button', { type: 'button', class: 'button', 'data-focus': 'older-days', text: t('web.olderDays'), onclick: () => { logShown += LOG_PAGE; render({ keepFocus: true }); } })
    : null;
  main.replaceChildren(head, list, more ? el('p', {}, more) : null);
}

// ---------- assets ----------
async function renderAssets() {
  const { assets } = await api(`/api/projects/${encodeURIComponent(view.slug)}/assets`);
  const head = el('div', { class: 'page-head' }, el('h1', { text: t('web.tab.assets') }));
  if (assets.length === 0) return main.replaceChildren(head, el('p', { class: 'empty', text: t('web.noAssets') }));
  const src = (name) => `/api/projects/${encodeURIComponent(view.slug)}/assets/${encodeURIComponent(name)}`;
  main.replaceChildren(head, el('ul', { class: 'gallery' },
    assets.map((a) => {
      const description = a.alt || `${a.name} · ${t('web.noAltText')}`;
      return el('li', {},
        el('figure', { class: 'shot' },
          el('button', { type: 'button', 'aria-label': t('web.enlarge', { name: description }), 'data-focus': `asset:${a.name}`, onclick: (e) => openViewer(src(a.name), description, e.currentTarget) },
            el('img', { src: src(a.name), alt: description, loading: 'lazy' })),
          el('figcaption', {}, description, a.taskId ? el('span', {}, ' · ', el('a', { href: href(view.slug, 'task', a.taskId), text: a.taskId })) : null),
        ),
      );
    }),
  ));
}

function openViewer(src, description, opener) {
  const viewer = $('viewer');
  $('viewer-title').textContent = description;
  const img = $('viewer-img');
  img.src = src;
  img.alt = description;
  returnFocusTo = opener;
  viewer.showModal();
}

// ---------- project ----------
async function renderProject() {
  const p = await api(`/api/projects/${encodeURIComponent(view.slug)}`);
  const prose = el('div', { class: 'prose detail', 'aria-label': p.name });
  if (p.html.trim()) prose.innerHTML = p.html; // Sanitised by the server.
  else prose.append(el('p', { class: 'muted', text: t('web.noDescription') }));
  main.replaceChildren(
    el('div', { class: 'page-head' },
      el('div', {}, el('h1', { text: p.name }), el('p', { class: 'mono muted', text: [p.repo, `${t('web.prefix')} ${p.idPrefix}`].filter(Boolean).join(' · ') })),
    ),
    prose,
  );
}

// ---------- projects ----------
function renderProjects() {
  if (projects.length === 0) {
    main.replaceChildren(el('h1', { text: t('web.projectsTitle') }), el('p', { class: 'empty', text: t('web.noProjects') }));
    return;
  }
  main.replaceChildren(
    el('div', { class: 'page-head' }, el('h1', { text: t('web.projectsTitle') })),
    el('ul', { class: 'project-list' },
      projects.map((p) => el('li', { class: 'project-item' },
        el('a', { href: href(p.slug), text: p.name }),
        el('div', { class: 'tags' }, STATUS_ORDER.map((s) => el('span', { class: `tag s-${s}`, text: `${statusLabel(s)} ${p.counts[s] ?? 0}` }))),
      )),
    ),
  );
}

function renderNotFound() {
  main.replaceChildren(el('p', { role: 'alert', text: t('web.projectNotFound', { slug: view.slug }) }), el('a', { href: '#/', text: t('web.projectsTitle') }));
}

// ---------- render loop ----------
let rendering = Promise.resolve();
function render({ keepFocus = false, firstPaint = false } = {}) {
  rendering = rendering.then(() => doRender(keepFocus, firstPaint)).catch(() => undefined);
  return rendering;
}

async function doRender(keepFocus, firstPaint) {
  const previous = view;
  view = parseHash();
  if (!view.slug && projects.length === 1) {
    location.replace(href(projects[0].slug));
    return;
  }
  // Remember focus so a refresh never moves it.
  const focusKey = keepFocus ? document.activeElement?.getAttribute('data-focus') : null;
  renderChrome();
  if (firstPaint || !keepFocus) loading();
  try {
    if (!view.slug) renderProjects();
    else if (!projects.some((p) => p.slug === view.slug)) renderNotFound();
    else if (view.page === 'board') await renderBoard();
    else if (view.page === 'task') await (WIDE.matches ? renderBoard() : renderTaskPage());
    else if (view.page === 'log') await renderLog();
    else if (view.page === 'assets') await renderAssets();
    else if (view.page === 'project') await renderProject();
  } catch (error) {
    failure(error, () => render());
    return;
  }
  if (focusKey) {
    main.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`)?.focus();
  } else if (!keepFocus && !firstPaint) {
    const sameBoard = previous && previous.slug === view.slug && previous.page === 'task' && view.page === 'board' && previous.id;
    if (view.page === 'task') main.querySelector('#task-title')?.focus();
    else if (sameBoard) main.querySelector(`[data-focus="task:${CSS.escape(previous.id)}"]`)?.focus();
    else {
      const heading = main.querySelector('h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    }
  }
}

async function loadProjects() {
  projects = (await api('/api/projects')).projects;
}

async function refresh({ announce = true } = {}) {
  // Never disturb an open dialog: apply the update once it closes.
  if ($('viewer').open) {
    if (announce) pendingChanges += 1;
    return;
  }
  try {
    await loadProjects();
  } catch {
    return;
  }
  await render({ keepFocus: true });
  if (announce) setLive(t('web.updated', { n: Math.max(pendingChanges, 1) }));
  pendingChanges = 0;
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 250);
}

// ---------- live updates ----------
let source;
let offline = false;
function connect() {
  source?.close();
  source = new EventSource('/api/events');
  source.addEventListener('open', () => {
    if (offline) {
      offline = false;
      $('banner').hidden = true;
      setLive(t('web.reconnected'));
      scheduleRefresh();
    }
  });
  source.addEventListener('change', () => {
    pendingChanges += 1;
    scheduleRefresh();
  });
  source.addEventListener('error', () => {
    if (!offline) {
      offline = true;
      $('banner').hidden = false;
      setLive(t('web.offline'), 'offline');
    }
  });
}

// ---------- start ----------
async function start() {
  try {
    const i18n = await api('/api/i18n');
    messages = i18n.messages;
    lang = i18n.lang;
  } catch {
    // Without translations the keys are shown; the board still works.
  }
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  $('viewer-close').setAttribute('aria-label', t('web.close'));
  $('project-select').addEventListener('change', (e) => {
    if (e.target.value) location.hash = href(e.target.value);
  });
  $('banner-retry').addEventListener('click', () => {
    connect();
    refresh();
  });
  $('viewer-close').addEventListener('click', () => $('viewer').close());
  $('viewer').addEventListener('close', () => {
    returnFocusTo?.focus();
    returnFocusTo = null;
    if (pendingChanges > 0) refresh();
  });
  window.addEventListener('hashchange', () => render());
  WIDE.addEventListener('change', () => render({ keepFocus: true }));
  try {
    await loadProjects();
  } catch (error) {
    failure(error, () => location.reload());
    return;
  }
  await render({ firstPaint: true });
  setLive(t('web.live'));
  connect();
  // Safety net when file events are missed (network drives, Docker): refetch every 30 s.
  setInterval(() => {
    if (!document.hidden) refresh({ announce: false });
  }, 30_000);
}

start();
