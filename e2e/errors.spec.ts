import { expect, test, type Page } from '@playwright/test';
import { E2E_PORTS } from './paths.ts';

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, 'no horizontal page scroll').toBeLessThanOrEqual(client);
}

test.describe('error records (read only)', () => {
  test('the Errors tab lists open and resolved errors, resolved limited to 10', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/errores');
    await page.getByRole('navigation', { name: 'Vistas' }).getByRole('link', { name: 'Errores' }).click();
    await expect(page).toHaveURL(/#\/errores\/errors$/);
    await expect(page.getByRole('link', { name: 'Errores' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: 'Errores' })).toBeFocused();

    const open = page.getByRole('region', { name: /Abiertos/ });
    await expect(open.getByRole('heading', { level: 2 })).toHaveText(/^Abiertos\s*1$/);
    await expect(open.getByRole('listitem')).toHaveCount(1);
    await expect(open.getByRole('listitem')).toContainText('Abierto');
    await expect(open.getByRole('listitem')).toContainText('Tarea FAL-1');

    const resolved = page.getByRole('region', { name: /Resueltos/ });
    await expect(resolved.getByRole('listitem')).toHaveCount(10);
    await expect(resolved.getByRole('listitem').first()).toContainText('ERR-13');
    await resolved.getByRole('button', { name: 'Ver los 12 resueltos' }).click();
    await expect(resolved.getByRole('listitem')).toHaveCount(12);
    await expect(page.locator('#errors-resolved')).toBeFocused();
    await expect(page.locator('main')).not.toContainText('null');
    await expect(page.locator('.board-area')).toHaveCount(0);
  });

  test('the error page shows every field, hostile text as data and the notes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/errores/errors');
    await page.getByRole('link', { name: /El bundle falla con require dinámico/ }).click();
    await expect(page).toHaveURL(/#\/errores\/errors\/ERR-1$/);
    const title = page.getByRole('heading', { level: 1, name: /El bundle falla/ });
    await expect(title).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Fecha y contexto' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Causa · hipótesis' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Solución' })).toContainText('Sin dato');
    const output = page.locator('pre.output');
    await expect(output).toHaveAttribute('tabindex', '0');
    await expect(output).toContainText('Dynamic require of "process"');
    await expect(page.getByText('scripts/build.mjs')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Notas y recurrencias' }).getByRole('article')).toHaveCount(2);
    await expect(page.getByText('Recurrencia: también en Node 24.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator('main img')).toHaveCount(0);

    await page.getByRole('link', { name: '← Volver a Errores' }).click();
    await expect(page).toHaveURL(/#\/errores\/errors$/);
  });

  test('error → task → close returns to the error with focus on the task link', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/errores/errors/ERR-1');
    const taskLink = page.getByRole('link', { name: 'FAL-1 · Compilar el bundle' });
    await taskLink.click();
    await expect(page).toHaveURL(/#\/errores\/task\/FAL-1$/);
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('#task-title')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#\/errores\/errors\/ERR-1$/);
    await expect(dialog).toBeHidden();
    await expect(taskLink).toBeFocused();

    await taskLink.click();
    await dialog.getByRole('button', { name: 'Cerrar el detalle' }).click();
    await expect(page).toHaveURL(/#\/errores\/errors\/ERR-1$/);
    await expect(taskLink).toBeFocused();
  });

  test('task → error → Back reopens the task with focus on the error link', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/errores');
    await page.getByRole('link', { name: 'Compilar el bundle' }).click();
    const dialog = page.getByRole('dialog');
    const section = dialog.getByRole('region', { name: 'Errores (13)' });
    await expect(section.getByRole('listitem')).toHaveCount(13);
    await expect(section.getByRole('listitem').first()).toContainText('Abierto');
    const errorLink = section.getByRole('link', { name: /ERR-1 · El bundle falla/ });
    await errorLink.click();
    await expect(page).toHaveURL(/#\/errores\/errors\/ERR-1$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: /El bundle falla/ })).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/#\/errores\/task\/FAL-1$/);
    await expect(dialog.getByRole('link', { name: /ERR-1 · El bundle falla/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#\/errores$/);
    await expect(page.getByRole('link', { name: 'Compilar el bundle' })).toBeFocused();
  });

  test('empty and missing states', async ({ page }) => {
    await page.goto('/#/errores/task/FAL-2');
    await expect(page.getByRole('dialog').getByText('Esta tarea no tiene errores registrados.')).toBeVisible();
    await page.goto('/#/errores/errors/ERR-99');
    await expect(page.getByRole('heading', { level: 1, name: 'Error no encontrado' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('No existe el error ERR-99.');
    await page.goto('/#/wayfinder/errors');
    await expect(page.getByText(/Aún no hay errores registrados/)).toBeVisible();
  });

  test('compact width: the error page fits at 320 px; only the output scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/#/errores/errors/ERR-1');
    await expect(page.getByRole('heading', { level: 1, name: /El bundle falla/ })).toBeVisible();
    await noHorizontalScroll(page);
    const overflow = await page.locator('pre.output').evaluate((pre) => pre.scrollWidth > pre.clientWidth);
    expect(overflow).toBe(true);
    await page.goto('/#/errores/errors');
    await expect(page.getByRole('heading', { level: 1, name: 'Errores' })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test('accessibility tree of the errors list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/errores/errors');
    await expect(page.getByRole('region', { name: /Abiertos/ })).toMatchAriaSnapshot(`
      - region "Abiertos 1":
        - heading "Abiertos 1" [level=2]
        - list:
          - listitem:
            - text: ERR-1
            - time
            - link "El bundle falla con require dinámico <img src=x onerror=window.__xss=6>"
            - text: Abierto Tarea FAL-1
    `);
  });

  test('English: labels are translated', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${E2E_PORTS.en}/#/errores/errors/ERR-1`);
    await expect(page.getByRole('heading', { level: 2, name: 'Observed output' })).toBeVisible();
    await expect(page.getByRole('link', { name: '← Back to Errors' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Errors', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Open', { exact: true })).toBeVisible();
  });
});
