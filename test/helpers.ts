import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { initHome } from '../src/store/init.ts';
import { createProject } from '../src/store/project.ts';

/** Fresh WAYFINDER_HOME in the OS temp folder: tests never touch the real ~/.wayfinder. */
export function makeHome(t: { after: (fn: () => void) => void }): string {
  const base = mkdtempSync(join(tmpdir(), 'wf-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const home = join(base, 'home');
  initHome(home);
  return home;
}

/**
 * WAY-24: a data folder as Wayfinder wrote it before the format mark existed (0.1.0), built from
 * frozen literals, never with initHome: whatever the code writes today must still open it. The files
 * are copied from a folder the store wrote at 8c419d3; WF-1 carries a key no version knows (estimate)
 * and config.json an extra key.
 */
export const LEGACY_FILES: Readonly<Record<string, string>> = {
  '.gitignore': '.wayfinder.lock\n*.tmp\n.state/\n',
  'config.json': '{\n  "language": "es",\n  "theme": "dark"\n}\n',
  'projects/demo/PROJECT.md': '---\nslug: demo\nname: Demo\nlocalPath: D:/demo\nidPrefix: WF\nstack: []\n---\n',
  'projects/demo/tasks/WF-1-primera.md':
    '---\nid: WF-1\ntitle: Primera\nstatus: todo\npriority: medium\norigin: user\ncreated: 2026-10-21T13:05:01+02:00\nupdated: 2026-10-21T13:05:03+02:00\nplan: ""\nestimate: 3\n---\n\nDescripción.\n\n## Historial\n\n### 2026-10-21 13:05\n\nCreated (origin: user).\n\n### 2026-10-21 13:05\n\nAvanzamos en WF-1: algo.\n',
  'projects/demo/tasks/WF-2-propuesta.md':
    '---\nid: WF-2\ntitle: Propuesta\nstatus: proposed\npriority: high\norigin: claude\ncreated: 2026-10-21T13:05:02+02:00\nupdated: 2026-10-21T13:05:02+02:00\nplan: ""\n---\n\n## Historial\n\n### 2026-10-21 13:05\n\nCreated (origin: claude).\n',
  'projects/demo/errors/ERR-1-falla-la-compilacion.md':
    '---\nid: ERR-1\ntitle: Falla la compilación\nstatus: open\ntask: WF-1\ncause_kind: hypothesis\nfiles: []\ncreated: 2026-10-21T13:05:04+02:00\nupdated: 2026-10-21T13:05:04+02:00\n---\n\n## Contexto\n\nnpm run build\n\n## Salida observada\n\nerror TS2345\n\n## Historial\n\n### 2026-10-21 13:05\n\nCreated (task: WF-1).\n',
  'projects/demo/log/2026-10-21.md': '# 2026-10-21\n\n## 13:05 · WF-1\n\n[WF-1 · Primera](#/demo/task/WF-1/2) — Avanzamos en WF-1: algo.\n',
};

export function makeLegacyHome(t: { after: (fn: () => void) => void }): string {
  const base = mkdtempSync(join(tmpdir(), 'wf-legacy-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const home = join(base, 'home');
  for (const [rel, content] of Object.entries(LEGACY_FILES)) {
    mkdirSync(dirname(join(home, rel)), { recursive: true });
    writeFileSync(join(home, rel), content);
  }
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', home, '-c', 'user.name=Wayfinder', '-c', 'user.email=wayfinder@localhost', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'wf: init');
  return home;
}

export function makeProject(home: string, slug = 'demo', idPrefix = 'WF'): void {
  createProject(home, { slug, name: 'Demo', idPrefix, localPath: 'D:/demo' });
}

export function fixedClock(iso = '2026-10-21T13:05:00'): () => Date {
  let ms = new Date(iso).getTime();
  return () => new Date((ms += 1000));
}

/**
 * The MCP tools, sorted. One list for the host and the Docker tests: test:docker is not part of
 * npm test, so a copy of its own went stale twice when a tool was added (ERR-2).
 */
export const MCP_TOOLS = ['wf_attach', 'wf_create', 'wf_error', 'wf_errors', 'wf_get', 'wf_history', 'wf_list', 'wf_log', 'wf_project', 'wf_review', 'wf_search', 'wf_set_status', 'wf_update', 'wf_web'];

export const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Map of every file under `dir` (except .git) to its hash. */
export function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const full = join(e.parentPath, e.name);
    const rel = relative(dir, full).replaceAll('\\', '/');
    if (rel === '.git' || rel.startsWith('.git/')) continue;
    if (statSync(full).isFile()) out[rel] = sha(full);
  }
  return out;
}

export function gitOut(home: string, ...args: string[]): string {
  return execFileSync('git', ['-C', home, ...args], { encoding: 'utf8' }).trim();
}

export function commitCount(home: string): number {
  return Number(gitOut(home, 'rev-list', '--count', 'HEAD'));
}
