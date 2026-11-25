import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { versionProblems } from '../scripts/versions.mjs';

const manifests = (pkg: string, lock: string, lockRoot: string, plugin: string) => ({
  pkg: { version: pkg },
  lock: { version: lock, packages: { '': { version: lockRoot } } },
  plugin: { version: plugin },
});

test('versionProblems: the same number everywhere is no problem', () => {
  assert.deepEqual(versionProblems(manifests('1.2.3', '1.2.3', '1.2.3', '1.2.3')), []);
});

test('versionProblems: each file and field that differs is reported with both values', () => {
  assert.deepEqual(versionProblems(manifests('1.2.3', '1.2.3', '1.2.3', '1.2.4')), [
    'plugin/.claude-plugin/plugin.json: version is "1.2.4" but package.json version is "1.2.3"',
  ]);
  assert.deepEqual(versionProblems(manifests('1.2.3', '1.2.2', '1.2.3', '1.2.3')), [
    'package-lock.json: version is "1.2.2" but package.json version is "1.2.3"',
  ]);
  assert.deepEqual(versionProblems(manifests('1.2.3', '1.2.3', '1.2.2', '1.2.3')), [
    'package-lock.json: packages[""].version is "1.2.2" but package.json version is "1.2.3"',
  ]);
});

test('versionProblems: several differences are all listed', () => {
  assert.equal(versionProblems(manifests('2.0.0', '1.0.0', '1.0.0', '1.0.0')).length, 3);
});

test('versionProblems: a missing field is reported, never thrown', () => {
  assert.deepEqual(versionProblems({ pkg: { version: '1.2.3' }, lock: {}, plugin: {} }), [
    'package-lock.json: version is missing',
    'package-lock.json: packages[""].version is missing',
    'plugin/.claude-plugin/plugin.json: version is missing',
  ]);
  assert.deepEqual(versionProblems({ pkg: {}, lock: {}, plugin: {} }), ['package.json: version is missing']);
});

test('the package, the lockfile and the plugin of this repository declare the same version', () => {
  const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8'));
  assert.deepEqual(
    versionProblems({ pkg: read('package.json'), lock: read('package-lock.json'), plugin: read('plugin/.claude-plugin/plugin.json') }),
    [],
  );
});
