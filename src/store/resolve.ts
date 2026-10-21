import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { WayfinderError } from './errors.ts';
import { isWithin, slugify } from './paths.ts';
import { listProjects, requireProject, type Project } from './project.ts';

/** Finds the repository root (the folder that holds `.git`) walking up from `dir`. */
export function findRepoRoot(dir: string): string | null {
  let current = resolve(dir);
  for (;;) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Reads remote.origin.url straight from the git config files. Wayfinder never runs git
 * against the consumer repository (and `remote`/`config` are outside its allow-list).
 */
export function readOriginUrl(root: string): string | null {
  let gitDir = join(root, '.git');
  try {
    if (statSync(gitDir).isFile()) {
      const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(gitDir, 'utf8'));
      if (!pointer) return null;
      gitDir = resolve(root, pointer[1].trim());
      const common = join(gitDir, 'commondir');
      if (existsSync(common)) gitDir = resolve(gitDir, readFileSync(common, 'utf8').trim());
    }
    const config = readFileSync(join(gitDir, 'config'), 'utf8');
    const section = /\[remote\s+"origin"\]([^[]*)/.exec(config);
    const url = section ? /^\s*url\s*=\s*(.+)$/m.exec(section[1]) : null;
    return url ? url[1].trim() : null;
  } catch {
    return null;
  }
}

/** host/owner/repo, lowercase host, without scheme, credentials, port or `.git`. */
export function normalizeRemote(url: string): string {
  let s = url.trim();
  const scp = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/)(.+)$/.exec(s);
  if (scp && !/^[a-z]+:\/\//i.test(s)) s = `${scp[1]}/${scp[2]}`;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^@/]*@/, '');
  const [host, ...rest] = s.split('/');
  return [host.replace(/:\d+$/, '').toLowerCase(), ...rest].join('/').replace(/\.git\/?$/, '').replace(/\/+$/, '');
}

const samePath = (a: string, b: string) => {
  const norm = (p: string) => resolve(p).replaceAll('\\', '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

export interface Resolved {
  project: Project;
  /** Root of the consumer repository when known (needed to verify plans and captures). */
  consumerRoot?: string;
}

export interface ResolveInput {
  project?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

function consumerDir(input: ResolveInput): string | undefined {
  const env = input.env ?? process.env;
  const dir = env.CLAUDE_PROJECT_DIR?.trim() || input.cwd;
  if (!dir) return undefined;
  return findRepoRoot(dir) ?? resolve(dir);
}

export function matchProject(home: string, root: string): Project | null {
  const remote = readOriginUrl(root);
  const projects = listProjects(home);
  if (remote) {
    const key = normalizeRemote(remote);
    const byRemote = projects.find((p) => p.repo && normalizeRemote(p.repo) === key);
    if (byRemote) return byRemote;
  }
  return projects.find((p) => p.localPath && samePath(p.localPath, root)) ?? null;
}

/** Order from the plan: explicit `project` > WAYFINDER_PROJECT > CLAUDE_PROJECT_DIR > cwd. */
export function resolveProject(home: string, input: ResolveInput = {}): Resolved {
  const env = input.env ?? process.env;
  const root = consumerDir(input);
  const explicit = input.project?.trim() || env.WAYFINDER_PROJECT?.trim();
  if (explicit) {
    const project = requireProject(home, explicit);
    const matches = root && matchProject(home, root)?.slug === project.slug;
    const fallback = project.localPath && existsSync(project.localPath) ? project.localPath : undefined;
    return { project, consumerRoot: matches ? root : fallback };
  }
  if (root) {
    const project = matchProject(home, root);
    if (project) return { project, consumerRoot: root };
  }
  const known = listProjects(home).map((p) => p.slug);
  throw new WayfinderError('resolve.notRegistered', { projects: known.length ? known.join(', ') : '—' });
}

/** Suggested registration values for the consumer repository. */
export function suggestRegistration(root: string): { slug: string; name: string; idPrefix: string; repo?: string; localPath: string } {
  const name = basename(root);
  const slug = slugify(name);
  const letters = slug.replace(/[^a-z]/g, '').toUpperCase();
  const idPrefix = (letters.length >= 2 ? letters.slice(0, 3) : `${letters}WF`.slice(0, 2)).padEnd(2, 'X');
  const remote = readOriginUrl(root);
  return { slug, name, idPrefix, repo: remote ? normalizeRemote(remote) : undefined, localPath: root.replaceAll('\\', '/') };
}

/** A plan reference must be `Planes/<file>.md` and exist inside the consumer repository. */
export function makePlanExists(consumerRoot: string | undefined): ((plan: string) => boolean) | undefined {
  if (!consumerRoot) return undefined;
  return (plan: string) => {
    if (isAbsolute(plan) || !/^Planes\/[^/\\]+\.md$/.test(plan)) return false;
    const full = resolve(consumerRoot, plan);
    return isWithin(consumerRoot, full) && existsSync(full) && statSync(full).isFile();
  };
}
