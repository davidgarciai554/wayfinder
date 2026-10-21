// Builds one bundle and writes it to dist/ (npm and Docker) and plugin/dist/ (versioned plugin copy).
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

/** @param {string} outRoot directory that receives dist/ and plugin/dist/ */
export async function buildAll(outRoot = root) {
  const targets = [join(outRoot, 'dist'), join(outRoot, 'plugin', 'dist')];
  const [primary, ...copies] = targets;
  for (const dir of targets) await rm(dir, { recursive: true, force: true });

  await build({
    entryPoints: [join(root, 'src', 'cli.ts')],
    outfile: join(primary, 'wayfinder.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    legalComments: 'eof',
    // CommonJS dependencies (yaml) call require() at runtime; an ESM bundle must provide it.
    banner: { js: "#!/usr/bin/env node\nimport { createRequire as __wfCreateRequire } from 'node:module';\nconst require = __wfCreateRequire(import.meta.url);" },
    define: { __WAYFINDER_VERSION__: JSON.stringify(pkg.version) },
    logLevel: 'warning',
  });

  const web = join(root, 'web');
  if (existsSync(web)) await cp(web, join(primary, 'web'), { recursive: true });

  for (const dir of copies) {
    await mkdir(dir, { recursive: true });
    await cp(primary, dir, { recursive: true });
  }
  return targets;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const targets = await buildAll();
  console.log(`build: ${targets.join(', ')}`);
}
