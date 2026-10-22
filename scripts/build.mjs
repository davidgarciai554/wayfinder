// Builds one bundle and writes it to dist/ (npm and Docker) and plugin/dist/ (versioned plugin copy).
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

/** @param {string} outRoot directory that receives dist/ and plugin/dist/ */
export async function buildAll(outRoot = root) {
  const targets = [join(outRoot, 'dist'), join(outRoot, 'plugin', 'dist')];
  const [primary, ...copies] = targets;
  for (const dir of targets) await rm(dir, { recursive: true, force: true });

  const result = await build({
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
    metafile: true,
  });
  await writeFile(join(primary, 'THIRD_PARTY_NOTICES.md'), await notices(result.metafile));

  const web = join(root, 'web');
  if (existsSync(web)) await cp(web, join(primary, 'web'), { recursive: true });

  for (const dir of copies) {
    await mkdir(dir, { recursive: true });
    await cp(primary, dir, { recursive: true });
  }
  return targets;
}

/**
 * Licence texts of every npm package that ends up in the bundle (MIT and similar licences
 * require the notice to travel with the code). Packages come from the esbuild metafile.
 */
async function notices(metafile) {
  const dirs = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const m = input.replaceAll('\\', '/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
    if (m) dirs.add(m[1]);
  }
  const fence = '```';
  const sections = [];
  for (const dir of [...dirs].sort()) {
    const abs = join(root, dir);
    const meta = JSON.parse(await readFile(join(abs, 'package.json'), 'utf8'));
    const licenceFile = readdirSync(abs).find((n) => /^licen[cs]e([.-]|$)/i.test(n));
    const text = licenceFile
      ? (await readFile(join(abs, licenceFile), 'utf8')).replace(/\r\n?/g, '\n').trim()
      : `License: ${meta.license ?? 'unknown'} (no licence file in the package)`;
    sections.push([`## ${meta.name}@${meta.version} (${meta.license ?? 'unknown'})`, '', `${fence}text`, text, fence].join('\n'));
  }
  return ['# Third-party notices', '', 'wayfinder.mjs bundles the following npm packages.', '', sections.join('\n\n'), ''].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const targets = await buildAll();
  console.log(`build: ${targets.join(', ')}`);
}
