import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { e2eGitOffFlag, e2eHome, e2eKeyFile, E2E_HOME, E2E_PORTS } from './paths.ts';

// Increment 5: create, approve and discard from the web, on the "escritura" project only.
const TASKS = join(E2E_HOME, 'projects', 'escritura', 'tasks');
const BOARD = '/#/escritura/board';

const commits = () => Number(execFileSync('git', ['-C', E2E_HOME, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim());
const lastSubject = () => execFileSync('git', ['-C', E2E_HOME, 'log', '-1', '--format=%s'], { encoding: 'utf8' }).trim();
const taskFile = (id: string) => join(TASKS, readdirSync(TASKS).find((n) => n.startsWith(`${id}-`)) ?? `${id}.md`);
const read = (id: string) => readFileSync(taskFile(id), 'utf8');

async function openWithKey(page: Page, lang: 'es' | 'en' = 'es') {
  const base = `http://127.0.0.1:${E2E_PORTS[lang]}`;
  await page.goto(`${base}/?k=${readFileSync(e2eKeyFile(lang), 'utf8')}`);
  await expect(page).toHaveURL(`${base}/`);
  await page.goto(`${base}${BOARD}`);
}

test.describe.configure({ mode: 'serial' });

test.describe('web writes', () => {
  test('without the key the board is read-only and says how to enable writes', async ({ page }) => {
    await page.goto(BOARD);
    await expect(page.getByText(/^Solo lectura\. Para crear, aprobar o descartar/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Aprobar/ })).toHaveCount(0);
    // A request made from the page itself without the cookie is refused too.
    const status = await page.evaluate(async () => (await fetch('/api/projects/escritura/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'x' }) })).status);
    expect(status).toBe(401);
  });

  test('another local site cannot write, even with the key cookie in the browser', async ({ page }) => {
    await openWithKey(page);
    const before = commits();
    const files = readdirSync(TASKS).map((n) => n + readFileSync(join(TASKS, n), 'utf8')).join();
    // Same site (127.0.0.1), different origin: SameSite does not help here; Origin and JSON do.
    await page.goto(`http://127.0.0.1:${E2E_PORTS.en}/`);
    const outcome = await page.evaluate(async (target) => {
      const results: string[] = [];
      const url = `${target}/api/projects/escritura/tasks`;
      try {
        await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{"title":"csrf json"}' });
        results.push('json sent');
      } catch {
        results.push('json blocked');
      }
      await fetch(url, { method: 'POST', mode: 'no-cors', credentials: 'include', headers: { 'Content-Type': 'text/plain' }, body: '{"title":"csrf text"}' }).catch(() => undefined);
      return results;
    }, `http://127.0.0.1:${E2E_PORTS.es}`);
    expect(outcome).toEqual(['json blocked']);
    expect(commits()).toBe(before);
    expect(readdirSync(TASKS).map((n) => n + readFileSync(join(TASKS, n), 'utf8')).join()).toBe(files);
  });

  test('create a task: errors next to the field, draft kept, message, commit and focus', async ({ page }) => {
    await openWithKey(page);
    const before = commits();
    const open = page.getByRole('button', { name: 'Nueva tarea' });
    await open.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Nueva tarea' });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Título')).toBeFocused();

    await page.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(dialog.locator('#create-name-error')).toHaveText('Escribe un título.');
    await expect(page.getByLabel('Título')).toBeFocused();
    await expect(page.getByLabel('Título')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Título').fill('Tarea creada desde la web');
    await page.getByLabel('Descripción').fill('token ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    await page.getByLabel('Prioridad').selectOption('high');
    await page.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(dialog.locator('#create-body-error')).toContainText('parece contener un secreto');
    await expect(page.getByLabel('Descripción')).toBeFocused();
    await expect(page.getByLabel('Título')).toHaveValue('Tarea creada desde la web');

    // Esc closes and keeps the draft; focus goes back to the opener.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await expect(page.getByLabel('Título')).toHaveValue('Tarea creada desde la web');
    await expect(page.getByLabel('Prioridad')).toHaveValue('high');

    await page.getByLabel('Descripción').fill('Creada en la prueba e2e.');
    await page.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(dialog).toBeHidden();
    const message = page.locator('#flash');
    await expect(message).toHaveText('Creada ESC-5 en «Por hacer».');
    const card = page.locator('#column-todo').getByRole('link', { name: 'Tarea creada desde la web' });
    await expect(card).toBeFocused();
    expect(commits()).toBe(before + 1);
    expect(lastSubject()).toBe('wf: create ESC-5');
    expect(read('ESC-5')).toMatch(/status: todo[\s\S]*priority: high[\s\S]*origin: user/);
    await page.waitForTimeout(5200);
    await expect(message).toHaveText('Creada ESC-5 en «Por hacer».');
  });

  test('approve a proposal: it moves to To do without reloading, approvedVia web', async ({ page }) => {
    await openWithKey(page);
    const before = commits();
    await page.getByRole('button', { name: 'Aprobar «Propuesta para aprobar»' }).click();
    const card = page.locator('#column-todo').getByRole('link', { name: 'Propuesta para aprobar' });
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
    await expect(page.locator('#column-proposed').getByText('Propuesta para aprobar')).toHaveCount(0);
    await expect(page.locator('#flash')).toHaveText('ESC-1 aprobada: pasa a «Por hacer».');
    expect(read('ESC-1')).toMatch(/status: todo/);
    expect(read('ESC-1')).toMatch(/approvedVia: web/);
    expect(commits()).toBe(before + 1);
  });

  test('discard asks first: Esc and Cancel change nothing, Confirm discards', async ({ page }) => {
    await openWithKey(page);
    const before = commits();
    const original = read('ESC-2');
    const opener = page.getByRole('button', { name: 'Descartar «Propuesta para descartar»' });
    const dialog = page.getByRole('alertdialog', { name: '¿Descartar «Propuesta para descartar»?' });

    await opener.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('ESC-2 pasará a «Descartadas»');
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page).toHaveURL(/#\/escritura\/board$/);

    await opener.click();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(read('ESC-2')).toBe(original);
    expect(commits()).toBe(before);

    await opener.click();
    await dialog.getByRole('button', { name: 'Descartar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#flash')).toHaveText('ESC-2 descartada.');
    await expect(page.locator('main').getByText('Propuesta para descartar')).toHaveCount(0);
    await expect(page.locator('#col-proposed')).toBeFocused();
    expect(read('ESC-2')).toMatch(/status: discarded/);
    expect(commits()).toBe(before + 1);
  });

  test('a task changed meanwhile answers 409 inside the dialog without losing it', async ({ page }) => {
    await openWithKey(page);
    const before = commits();
    await page.getByRole('button', { name: 'Descartar «Propuesta en conflicto»' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    // Someone else (Claude, another window) touches the task while the dialog is open.
    const file = taskFile('ESC-3');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^updated: .*$/m, 'updated: 2026-10-21T11:11:11'));
    await dialog.getByRole('button', { name: 'Descartar' }).click();
    await expect(dialog.getByRole('alert')).toContainText('cambió mientras la editabas');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Descartar' })).toBeFocused();
    expect(read('ESC-3')).toMatch(/status: proposed/);
    expect(commits()).toBe(before);
    await page.keyboard.press('Escape');
    await expect(page.locator('#column-proposed').getByRole('link', { name: 'Propuesta en conflicto' })).toBeVisible();
  });

  test('without git the change is kept and the message says so', async ({ page }) => {
    await openWithKey(page);
    writeFileSync(e2eGitOffFlag('es'), '');
    try {
      const before = commits();
      await page.getByRole('button', { name: 'Aprobar «Propuesta sin git»' }).click();
      await expect(page.locator('#flash')).toHaveText('ESC-4 aprobada: pasa a «Por hacer». Aviso: Cambio guardado, pero sin commit: no se encontró git.');
      await page.waitForTimeout(5200);
      await expect(page.locator('#flash')).toContainText('no se encontró git');
      expect(read('ESC-4')).toMatch(/status: todo/);
      expect(commits()).toBe(before);
    } finally {
      rmSync(e2eGitOffFlag('es'), { force: true });
    }
  });

  test('approve and discard from the task detail panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openWithKey(page);
    await page.goto('/#/escritura/task/ESC-5');
    await expect(page.locator('#task-title')).toHaveText('Tarea creada desde la web');
    const detail = page.locator('.detail');
    await expect(detail.getByRole('button', { name: /^Aprobar/ })).toHaveCount(0);
    await detail.getByRole('button', { name: 'Descartar «Tarea creada desde la web»' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
    await expect(page).toHaveURL(/#\/escritura\/board$/);
    await expect(page.locator('#flash')).toHaveText('ESC-5 descartada.');
    expect(read('ESC-5')).toMatch(/status: discarded/);
  });

  test('English: write controls are translated', async ({ page }) => {
    await openWithKey(page, 'en');
    await expect(page.getByRole('button', { name: 'New task' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve "Propuesta para aprobar"' })).toBeVisible();
    await page.getByRole('button', { name: 'New task' }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await expect(dialog).toBeVisible();
    const text = await dialog.innerText();
    expect(text).toContain('Create task');
    expect(text).not.toMatch(/Título|Descripción|Prioridad|Cancelar|Crear|Obligatorio|web\.[a-z]/);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Discard "Propuesta para descartar"' }).click();
    const confirm = page.getByRole('alertdialog');
    expect(await confirm.innerText()).not.toMatch(/Cancelar|Descartar|pasará/);
    await page.keyboard.press('Escape');
    // The English fixture is a separate data folder: nothing written there either.
    expect(readdirSync(join(e2eHome('en'), 'projects', 'escritura', 'tasks'))).toHaveLength(4);
  });
});
