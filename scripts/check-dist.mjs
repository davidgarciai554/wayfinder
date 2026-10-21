// Fails when dist/ or plugin/dist/ differ from a fresh build of the current sources.
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll } from './build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

async function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).replaceAll('\\', '/'))
    .sort();
}

const tmp = await mkdtemp(join(tmpdir(), 'wayfinder-check-'));
const problems = [];
try {
  await buildAll(tmp);
  for (const sub of ['dist', join('plugin', 'dist')]) {
    const fresh = join(tmp, sub);
    const current = join(root, sub);
    const [freshFiles, currentFiles] = await Promise.all([listFiles(fresh), listFiles(current)]);
    if (freshFiles.join('\n') !== currentFiles.join('\n')) {
      problems.push(`${sub}: file list differs from a fresh build`);
      continue;
    }
    for (const file of freshFiles) {
      const [a, b] = await Promise.all([readFile(join(fresh, file)), readFile(join(current, file))]);
      if (!a.equals(b)) problems.push(`${sub}/${file}: content differs from a fresh build`);
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`check:dist failed. Run "npm run build".\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('check:dist: dist/ and plugin/dist/ match a fresh build');
}
