import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_HOME, E2E_PORTS } from './paths.ts';

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, 'no horizontal page scroll').toBeLessThanOrEqual(client);
}

test.describe('web board (read-only)', () => {
  test('home lists both projects and the board shows columns, counts and flags', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeVisible();
    await page.getByRole('link', { name: 'wayfinder', exact: true }).last().click();
    await expect(page).toHaveURL(/#\/wayfinder\/board$/);
    await expect(page.getByRole('heading', { level: 1, name: 'wayfinder' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    for (const name of ['Propuestas', 'Por hacer', 'En curso', 'Hechas']) {
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expect(page.locator('#col-proposed .count')).toHaveText('2');
    await expect(page.locator('#column-done .card')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Ver todas las hechas (12)' })).toBeVisible();
    await expect(page.getByText('Aprobada por chat').first()).toBeVisible();
    await expect(page.getByText('Aprobada pese a aviso').first()).toBeVisible();
    await expect(page.getByText('Modificada fuera de Wayfinder').first()).toBeVisible();
    await expect(page.getByText(/Tareas ilegibles: 1/)).toBeVisible();
    await expect(page.getByText('projects/wayfinder/tasks/WF-99-rota.md')).toBeVisible();
    await expect(page.locator('main .notice')).toContainText('falta el id o no es válido');
    await expect(page.locator('#column-discarded')).toHaveCount(0);
    await expect(page.locator('#banner')).toBeHidden();

    await page.getByRole('button', { name: 'Ver todas las hechas (12)' }).click();
    await expect(page.locator('#column-done .card')).toHaveCount(12);
    await page.getByLabel('Mostrar descartadas').check();
    await expect(page.locator('#column-discarded .card-title')).toHaveText('Idea descartada');
  });

  test('task content is rendered as safe Markdown and titles as text', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/wayfinder/board');
    await page.getByRole('link', { name: '<img src=x onerror=window.__xss=1>' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '<img src=x onerror=window.__xss=1>' })).toBeVisible();
    await expect(page.locator('.detail .prose')).toContainText('<script>window.__xss=2</script>');
    await expect(page.locator('.detail .prose a[href^="javascript"]')).toHaveCount(0);
    await expect(page.locator('.detail .prose h2', { hasText: 'Encabezado' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test('keyboard only: open a task in the side panel and return focus to its card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/wayfinder/board');
    await expect(page.locator('.card').first()).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    const target = page.getByRole('link', { name: 'Añadir filtro por prioridad al tablero' });
    await target.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/task\/WF-3$/);
    await expect(page.locator('#task-title')).toBeFocused();
    await expect(page.locator('.detail')).toContainText('Alta');
    await expect(page.locator('.detail img')).toHaveAttribute('alt', 'Filtro desplegado');
    await expect(page.locator('.card[aria-current="true"] .card-title')).toHaveText('Añadir filtro por prioridad al tablero');
    await page.getByRole('link', { name: 'Cerrar el detalle' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/board$/);
    await expect(target).toBeFocused();
  });

  test('narrow screens open the task as a page and never scroll horizontally', async ({ page }) => {
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/#/wayfinder/board');
      await expect(page.locator('.card').first()).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Ir a columna' })).toBeVisible();
      await noHorizontalScroll(page);
    }
    await page.goto('/#/wayfinder/task/WF-3');
    await expect(page.locator('.detail-page')).toBeVisible();
    await expect(page.locator('.columns')).toHaveCount(0);
    await noHorizontalScroll(page);
  });

  test('an external edit appears without reloading and keeps focus', async ({ page }) => {
    await page.goto('/#/wayfinder/board');
    const toggle = page.getByLabel('Mostrar descartadas');
    await toggle.focus();
    const dir = join(E2E_HOME, 'projects', 'wayfinder', 'tasks');
    const file = join(dir, 'WF-4-revisar-contraste-del-modo-oscuro.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('Revisar contraste del modo oscuro', 'Contraste revisado desde fuera'));
    await expect(page.getByRole('link', { name: 'Contraste revisado desde fuera' })).toBeVisible({ timeout: 3000 });
    await expect(toggle).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: /Actualizado/ })).toBeVisible();
  });

  test('a lost connection shows a persistent banner with Retry', async ({ page }) => {
    await page.goto('/#/wayfinder/board');
    await expect(page.locator('.card').first()).toBeVisible();
    await expect(page.locator('#banner')).toBeHidden();
    await page.route('**/api/events', (route) => route.abort());
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Sin conexión con Wayfinder' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });

  test('log, screenshots (with viewer) and project pages', async ({ page }) => {
    await page.goto('/#/wayfinder/log');
    await expect(page.getByRole('heading', { level: 1, name: 'Bitácora' })).toBeVisible();
    await expect(page.locator('.day').first()).toContainText('Implementado el filtro');

    await page.getByRole('link', { name: 'Capturas' }).click();
    const opener = page.getByRole('button', { name: 'Ampliar: Filtro desplegado' });
    await expect(opener).toBeVisible();
    await opener.click();
    await expect(page.getByRole('dialog', { name: 'Filtro desplegado' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(opener).toBeFocused();

    await page.getByRole('link', { name: 'Proyecto', exact: true }).click();
    await expect(page.getByText('Gestor de tareas en Markdown.')).toBeVisible();
    await expect(page.getByText('github.com/example/wayfinder · prefijo WF')).toBeVisible();
  });

  test('empty project shows an actionable empty state', async ({ page }) => {
    await page.goto('/#/demo-app/board');
    await expect(page.getByText('Aún no hay tareas. Pide a Claude que proponga ideas.')).toBeVisible();
    await page.goto('/#/nope/board');
    await expect(page.locator('main').getByRole('alert')).toContainText('No existe el proyecto «nope»');
  });

  test('accessibility tree of the board columns', async ({ page }) => {
    await page.goto('/#/wayfinder/board');
    await expect(page.locator('#column-in-progress')).toMatchAriaSnapshot(`
      - region "En curso 1":
        - heading "En curso 1" [level=2]
        - list:
          - listitem:
            - link "Galería de capturas por proyecto"
    `);
  });

  test('screenshots for visual review (light/dark, 320/768/1280)', async ({ browser }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      for (const width of [320, 768, 1280]) {
        const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce', viewport: { width, height: 900 } });
        const page = await context.newPage();
        await page.goto('/#/wayfinder/board');
        await expect(page.locator('.card').first()).toBeVisible();
        await page.screenshot({ path: `test-results/review/board-${colorScheme}-${width}.png`, fullPage: true });
        if (width === 1280) {
          await page.goto('/#/wayfinder/task/WF-3');
          await expect(page.locator('#task-title')).toBeVisible();
          await page.screenshot({ path: `test-results/review/task-${colorScheme}-${width}.png` });
        }
        await context.close();
      }
    }
  });

  test('English board: same flow, no Spanish text and no raw keys', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${E2E_PORTS.en}/#/wayfinder/board`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    for (const name of ['Proposals', 'To do', 'In progress', 'Done']) {
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expect(page.locator('main .notice')).toContainText('missing or invalid id');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\b(web|status|reason)\.[a-z]/);
    expect(text).not.toMatch(/Propuestas|Por hacer|Tablero|Bitácora|Mostrar descartadas|Sin aprobar/);
  });
});
