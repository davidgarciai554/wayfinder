import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { e2eHome, e2eKeyFile, E2E_PORTS, type E2ELang } from './paths.ts';

// WAY-24: the data-format notice and tasks whose status only a newer version knows, on the
// «formato» project. The mark is global to the data folder, so every test puts it back.
const BOARD = '/#/formato/board';
const base = (lang: E2ELang) => `http://127.0.0.1:${E2E_PORTS[lang]}`;
const mark = (lang: E2ELang) => join(e2eHome(lang), 'FORMAT');
const setMark = (lang: E2ELang, content: string) => writeFileSync(mark(lang), content);
const commits = (lang: E2ELang) => Number(execFileSync('git', ['-C', e2eHome(lang), 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim());
const tasksDir = (lang: E2ELang) => join(e2eHome(lang), 'projects', 'formato', 'tasks');
const snapshot = (lang: E2ELang) => readdirSync(tasksDir(lang)).sort().map((n) => n + readFileSync(join(tasksDir(lang), n), 'utf8')).join('\n');

async function openWithKey(page: Page, lang: E2ELang = 'es') {
  await page.goto(`${base(lang)}/?k=${readFileSync(e2eKeyFile(lang), 'utf8')}`);
  await expect(page).toHaveURL(`${base(lang)}/`);
  await page.goto(`${base(lang)}${BOARD}`);
}

test.describe.configure({ mode: 'serial' });

test.describe('data format (WAY-24)', () => {
  test.afterEach(() => {
    setMark('es', '1\n');
    setMark('en', '1\n');
  });

  test('a status only a newer version knows goes to «Otros estados», as text, with no actions', async ({ page }) => {
    await openWithKey(page);
    const files = snapshot('es');
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();
    const other = page.getByRole('region', { name: /^Otros estados/ });
    await expect(other.getByRole('heading', { level: 2 })).toHaveText(/^Otros estados\s*2$/);
    await expect(other.locator('.card')).toHaveCount(2);
    await expect(other.getByText('Estado desconocido: snoozed', { exact: true })).toBeVisible();
    await expect(other.getByText('Estado desconocido: review', { exact: true })).toBeVisible();
    // The hostile title is text; the literal status never becomes a class.
    await expect(other.getByRole('link', { name: '<img src=x onerror=window.__xss=9>' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator('.s-snoozed, .s-review')).toHaveCount(0);
    await expect(other.getByRole('button')).toHaveCount(0);
    // It is not counted as unreadable, and the known columns keep their tasks.
    await expect(page.getByText(/Tareas ilegibles/)).toHaveCount(0);
    await expect(page.locator('#col-todo .count')).toHaveText('1');

    await other.getByRole('link', { name: 'Pospuesta hasta diciembre' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 1, name: 'Pospuesta hasta diciembre' })).toBeVisible();
    await expect(dialog.locator('.pill').first()).toHaveText('Estado desconocido: snoozed');
    await expect(dialog.getByText('Esta versión de Wayfinder no conoce el estado de esta tarea: se puede leer, pero no cambiar.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^(Aprobar|Descartar|Reabrir)/ })).toHaveCount(0);
    expect(snapshot('es')).toBe(files);
  });

  test('with data from a newer format the page says so, becomes read only and keeps showing the tasks', async ({ page }) => {
    await openWithKey(page);
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();
    await expect(page.locator('#format-notice')).toBeHidden();
    const before = { commits: commits('es'), files: snapshot('es') };

    setMark('es', '2\n');
    // The notice appears on the next refresh or navigation, without restarting anything.
    await page.goto(`${base('es')}/#/formato/log`);
    await page.goto(`${base('es')}${BOARD}`);
    const notice = page.locator('#format-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'status');
    await expect(notice).toHaveText(/La carpeta de datos usa el formato 2 y esta versión de Wayfinder solo entiende hasta el 1: .*Reinicia esta sesión de Claude o actualiza Wayfinder/);
    await expect(notice).not.toHaveText(/ilegible/);
    await expect(page.locator('#banner')).toBeHidden();
    await expect(page.getByText('Solo lectura: los datos son de una versión más nueva de Wayfinder (ver el aviso de arriba).')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activar la escritura en este PC' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Tarea normal' })).toBeVisible();
    // Not focusable and no new tab stop: focus stays where it was.
    expect(await notice.evaluate((node) => node.querySelectorAll('a, button, input, [tabindex]').length + (node.hasAttribute('tabindex') ? 1 : 0))).toBe(0);

    // Even a request made from the page with the key is refused, and nothing changes.
    const reply = await page.evaluate(async () => {
      const res = await fetch('/api/projects/formato/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'No' }) });
      return { status: res.status, body: await res.json() };
    });
    expect(reply.status).toBe(409);
    expect(reply.body.error).toMatch(/^La carpeta de datos usa el formato 2/);
    expect({ commits: commits('es'), files: snapshot('es') }).toEqual(before);

    // A lost and recovered connection does not hide it: the two notices are separate.
    await page.route('**/api/events', (route) => route.abort());
    await page.reload();
    await expect(page.locator('#banner')).toBeVisible();
    await expect(notice).toBeVisible();
    await page.unroute('**/api/events');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('#banner')).toBeHidden();
    await expect(notice).toBeVisible();

    // Back to format 1: writing comes back on the next refresh.
    setMark('es', '1\n');
    await page.reload();
    await expect(notice).toBeHidden();
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();
  });

  test('an unreadable mark gets its own notice and does not block', async ({ page }) => {
    setMark('es', 'basura <b>');
    await openWithKey(page);
    const notice = page.locator('#format-notice');
    await expect(notice).toHaveText(/La marca de formato de la carpeta de datos \(archivo FORMAT\) no es un número/);
    await expect(notice).not.toContainText('basura');
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();
  });

  test('English: the notice, the read-only line and «Other statuses»', async ({ page }) => {
    setMark('en', '2\n');
    await openWithKey(page, 'en');
    await expect(page.locator('#format-notice')).toHaveText(/The data folder uses format 2 and this version of Wayfinder only understands up to 1/);
    await expect(page.getByText('Read only: the data comes from a newer version of Wayfinder (see the notice above).')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^Other statuses/ })).toBeVisible();
    await expect(page.getByText('Unknown status: snoozed', { exact: true })).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/web\.|status\.|Estado desconocido|Otros estados|Solo lectura/);
  });

  test('screenshots for visual review (light/dark, 320/768/1280)', async ({ browser }) => {
    setMark('es', '2\n');
    for (const colorScheme of ['light', 'dark'] as const) {
      for (const width of [320, 768, 1280]) {
        const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce', viewport: { width, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${base('es')}${BOARD}`);
        await expect(page.locator('#format-notice')).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: /^Otros estados/ })).toBeVisible();
        // No horizontal scroll at any width.
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: `test-results/review/format-${colorScheme}-${width}.png`, fullPage: true });
        await context.close();
      }
    }
  });
});
