import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

function run(args: string[], env: Record<string, string> = {}) {
  const { WAYFINDER_LANG: _lang, WAYFINDER_HOME: _home, ...base } = process.env;
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...base, ...env } });
}

test('--help lists the subcommands in Spanish by default', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Uso: wayfinder/);
  for (const cmd of ['init', 'mcp', 'serve', 'hook']) assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`));
});

test('--help follows WAYFINDER_LANG=en without Spanish text', () => {
  const r = run(['--help'], { WAYFINDER_LANG: 'en' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage: wayfinder/);
  assert.doesNotMatch(r.stdout, /Uso|Comandos|Arranca/);
});

test('an unknown subcommand exits with a non-zero code and a message on stderr', () => {
  const r = run(['nope']);
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /Comando desconocido: «nope»/);
});

test('--version prints a version', () => {
  const r = run(['--version']);
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});
