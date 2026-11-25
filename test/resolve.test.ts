import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject } from '../src/store/project.ts';
import { makePlanExists, resolveProject, rootKey } from '../src/store/resolve.ts';
import { makeHome } from './helpers.ts';

test('ERR-10: a session in a linked worktree resolves to the project of its main checkout and checks plans in the worktree', (t) => {
  const home = makeHome(t);
  const base = mkdtempSync(join(tmpdir(), 'wf-worktree-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const main = join(base, 'main');
  const worktree = join(base, 'side');
  mkdirSync(main);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', main, '-c', 'user.name=Wayfinder', '-c', 'user.email=wayfinder@localhost', '-c', 'commit.gpgsign=false', ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'remote.origin.url', 'https://github.com/example/demo.git');
  writeFileSync(join(main, 'README.md'), 'demo\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  git('worktree', 'add', '-q', '-b', 'side', worktree);
  mkdirSync(join(worktree, 'Planes'));
  writeFileSync(join(worktree, 'Planes', '2026-11-25-solo-en-worktree.md'), '# Plan\n');
  // Registered like the real projects: by local path only, without repo.
  createProject(home, { slug: 'demo', name: 'Demo', idPrefix: 'DEM', localPath: main.replaceAll('\\', '/') });
  const plan = 'Planes/2026-11-25-solo-en-worktree.md';

  for (const project of [undefined, 'demo']) {
    const resolved = resolveProject(home, { project, env: { CLAUDE_PROJECT_DIR: worktree } });
    assert.equal(resolved.project.slug, 'demo');
    assert.equal(rootKey(resolved.consumerRoot ?? ''), rootKey(worktree), `project: ${project}`);
    assert.equal(makePlanExists(resolved.consumerRoot)?.(plan), true, `project: ${project}`);
  }

  const fromMain = resolveProject(home, { env: { CLAUDE_PROJECT_DIR: main } });
  assert.equal(fromMain.project.slug, 'demo');
  assert.equal(rootKey(fromMain.consumerRoot ?? ''), rootKey(main));
  assert.equal(makePlanExists(fromMain.consumerRoot)?.(plan), false, 'the main checkout does not see the worktree plan');
});
