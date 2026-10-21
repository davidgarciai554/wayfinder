import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WayfinderError, type Warning } from './errors.ts';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.ts';
import { commitPaths } from './git.ts';
import { assertSlug, ID_PREFIX_RE, projectDir, safeJoin, SLUG_RE } from './paths.ts';
import { withLock, writeFileAtomic } from './sync.ts';

export interface Project {
  slug: string;
  name: string;
  idPrefix: string;
  repo?: string;
  localPath?: string;
  data: Record<string, unknown>;
  body: string;
}

export function readProject(home: string, slug: string): Project | null {
  const file = join(projectDir(home, slug), 'PROJECT.md');
  if (!existsSync(file)) return null;
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  if ('error' in parsed) return null;
  const { data, body } = parsed;
  if (typeof data.idPrefix !== 'string' || !ID_PREFIX_RE.test(data.idPrefix)) return null;
  return {
    slug,
    name: typeof data.name === 'string' ? data.name : slug,
    idPrefix: data.idPrefix,
    repo: typeof data.repo === 'string' && data.repo ? data.repo : undefined,
    localPath: typeof data.localPath === 'string' && data.localPath ? data.localPath : undefined,
    data,
    body,
  };
}

export function listProjects(home: string): Project[] {
  const dir = join(home, 'projects');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
    .map((e) => readProject(home, e.name))
    .filter((p): p is Project => p !== null)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function requireProject(home: string, slug: string): Project {
  const project = readProject(home, slug);
  if (!project) throw new WayfinderError('store.projectNotFound', { slug });
  return project;
}

export interface NewProject {
  slug: string;
  name: string;
  idPrefix: string;
  repo?: string;
  localPath?: string;
  /** Initial Markdown body; the caller provides it already translated. */
  body?: string;
}

export function createProject(home: string, input: NewProject): { project: Project; warnings: Warning[] } {
  assertSlug(input.slug);
  if (!ID_PREFIX_RE.test(input.idPrefix)) throw new WayfinderError('store.invalidIdPrefix', { value: input.idPrefix });
  if (!input.repo && !input.localPath) throw new WayfinderError('store.projectNeedsLocation', {});
  return withLock(home, () => {
    const dir = projectDir(home, input.slug);
    if (existsSync(join(dir, 'PROJECT.md'))) throw new WayfinderError('store.projectExists', { slug: input.slug });
    for (const other of listProjects(home)) {
      if (other.idPrefix === input.idPrefix) throw new WayfinderError('store.idPrefixTaken', { value: input.idPrefix, slug: other.slug });
      if (input.repo && other.repo === input.repo) throw new WayfinderError('store.repoTaken', { value: input.repo, slug: other.slug });
    }
    const data: Record<string, unknown> = { slug: input.slug, name: input.name };
    if (input.repo) data.repo = input.repo;
    if (input.localPath) data.localPath = input.localPath;
    data.idPrefix = input.idPrefix;
    data.stack = [];
    for (const sub of ['tasks', 'log', 'assets']) mkdirSync(safeJoin(home, 'projects', input.slug, sub), { recursive: true });
    writeFileAtomic(join(dir, 'PROJECT.md'), serializeFrontmatter(data, input.body ?? ''));
    const warnings = commitPaths(home, [`projects/${input.slug}/PROJECT.md`], `wf: register ${input.slug}`);
    return { project: readProject(home, input.slug)!, warnings };
  });
}
