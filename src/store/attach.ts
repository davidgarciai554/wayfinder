import { closeSync, copyFileSync, lstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { isAbsolute, resolve, sep } from 'node:path';
import { WayfinderError, type Warning } from './errors.ts';
import { commitPaths } from './git.ts';
import { assertNoSecrets } from './log.ts';
import { isWithin, projectDir, safeJoin } from './paths.ts';
import { requireProject } from './project.ts';
import { withLock } from './sync.ts';
import { readTask, writeTaskUnlocked } from './tasks.ts';
import { isoLocal, localDay, systemClock, type Clock } from './time.ts';

export const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;
export const MAX_ALT = 300;

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.subarray(0, 6).toString('latin1') === 'GIF87a' || b.subarray(0, 6).toString('latin1') === 'GIF89a',
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};
const EXT: Record<string, string> = { '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif', '.webp': 'webp' };

// Path segments that are never copied, whatever the allowed root says.
const DENIED_SEGMENT = /^(\.ssh|\.git|\.gnupg|\.aws|\.azure|\.kube|\.docker|\.npmrc|\.netrc|\.env.*|credentials?|secrets?|\.wayfinder)$/i;

export interface AttachInput {
  path: string;
  alt: string;
  taskId?: string;
  /** Folders a capture may come from: the consumer repository and the configured captures folder. */
  allowedRoots: string[];
}

export function attachCapture(
  home: string,
  slug: string,
  input: AttachInput,
  clock: Clock = systemClock,
): { asset: string; markdown: string; warnings: Warning[] } {
  requireProject(home, slug);
  const alt = input.alt.replace(/\s+/g, ' ').trim();
  if (alt === '' || alt.length > MAX_ALT || /[[\]]/.test(alt)) throw new WayfinderError('attach.invalidAlt', { max: MAX_ALT });
  assertNoSecrets(alt);
  if (!isAbsolute(input.path)) throw new WayfinderError('attach.notAbsolute', { path: input.path });

  const requested = resolve(input.path);
  let real: string;
  try {
    if (lstatSync(requested).isSymbolicLink()) throw new WayfinderError('attach.symlink', { path: input.path });
    real = realpathSync.native(requested);
  } catch (error) {
    if (error instanceof WayfinderError) throw error;
    throw new WayfinderError('attach.notFound', { path: input.path });
  }
  const norm = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
  // A different real path means a link or junction somewhere along the way.
  if (norm(real) !== norm(requested)) throw new WayfinderError('attach.symlink', { path: input.path });
  if (real.split(sep).some((segment) => DENIED_SEGMENT.test(segment))) throw new WayfinderError('attach.denied', { path: input.path });
  if (isWithin(home, real)) throw new WayfinderError('attach.denied', { path: input.path });
  const roots = input.allowedRoots.filter(Boolean);
  if (!roots.some((root) => isWithin(root, real))) throw new WayfinderError('attach.outsideAllowed', { path: input.path });

  const ext = EXT[real.slice(real.lastIndexOf('.')).toLowerCase()];
  if (!ext) throw new WayfinderError('attach.badType', { path: input.path });
  const stat = statSync(real);
  if (!stat.isFile()) throw new WayfinderError('attach.notFound', { path: input.path });
  if (stat.size > MAX_CAPTURE_BYTES) throw new WayfinderError('attach.tooLarge', { max: '10 MB' });
  const head = Buffer.alloc(12);
  const fd = openSync(real, 'r');
  try {
    readSync(fd, head, 0, 12, 0);
  } finally {
    closeSync(fd);
  }
  if (!MAGIC[ext](head)) throw new WayfinderError('attach.badType', { path: input.path });

  return withLock(home, () => {
    const now = clock();
    const name = `${localDay(now).replaceAll('-', '')}-${randomBytes(4).toString('hex')}.${ext}`;
    const target = safeJoin(projectDir(home, slug), 'assets', name);
    copyFileSync(real, target);
    const asset = `projects/${slug}/assets/${name}`;
    const paths = [asset];
    const markdown = `![${alt}](../assets/${name})`;
    if (input.taskId) {
      const task = readTask(home, slug, input.taskId);
      task.body = `${task.body.trimEnd()}\n\n${markdown}\n`;
      task.updated = isoLocal(now);
      writeTaskUnlocked(home, task);
      paths.push(task.file);
    }
    const warnings = commitPaths(home, paths, `wf: attach ${input.taskId ?? slug}`);
    return { asset, markdown, warnings };
  });
}
