import { expect, test, type Page } from '@playwright/test';
import { E2E_PORTS } from './paths.ts';

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, 'no horizontal page scroll').toBeLessThanOrEqual(client);
}

test.describe('task history and linked log', () => {
  test('from a log line to the history entry, and from the entry back to its log day', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/historial/log');
    const first = page.locator('#day-2026-10-21').locator('..');
    const link = first.getByRole('link', { name: 'HIS-1 · Filtro con memoria' });
    await expect(link).toHaveAttribute('href', '#/historial/task/HIS-1/3');
    await expect(first).toContainText('Avanzamos en el filtro: tests en verde.');
    await link.click();

    await expect(page).toHaveURL(/#\/historial\/task\/HIS-1\/3$/);
    const history = page.getByRole('region', { name: 'Historial' });
    await expect(history.getByRole('article')).toHaveCount(3);
    const entry = page.locator('#entry-3');
    await expect(entry).toBeFocused();
    await expect(entry).toContainText('tests en verde');
    await expect(entry).toContainText('Next: revisión visual');
    await expect(entry.locator('time')).toHaveAttribute('datetime', '2026-10-21T11:30');
    await expect(page.locator('#entry-1')).toContainText('Tarea creada · origen: Persona');
    await expect(page.locator('#entry-1').getByRole('link')).toHaveCount(0);
    await expect(page.locator('#task-description .prose')).toHaveText('Descripción de la tarea.');

    await page.locator('#entry-2').getByRole('link', { name: 'Ver en la bitácora del 2026-10-20' }).click();
    await expect(page).toHaveURL(/#\/historial\/log\/2026-10-20$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bitácora del 2026-10-20' })).toBeFocused();
    await expect(page.locator('.day')).toHaveCount(1);
    await expect(page.locator('.day')).toContainText('primer paso');
    await expect(page.getByRole('link', { name: 'Ver toda la bitácora' })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/#\/historial\/task\/HIS-1\/3$/);
    await expect(page.locator('#entry-3')).toBeFocused();
  });

  test('keyboard only: the log link opens the entry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/historial/log/2026-10-20');
    const link = page.getByRole('link', { name: 'HIS-1 · Filtro con memoria' });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#entry-2')).toBeFocused();
  });

  test('empty and edge states', async ({ page }) => {
    await page.goto('/#/historial/task/HIS-2');
    await expect(page.getByRole('heading', { level: 2, name: 'Historial' })).toBeVisible();
    await expect(page.getByText('Esta tarea aún no tiene entradas en su historial.')).toBeVisible();
    await expect(page.getByText('Escrita antes del historial.')).toBeVisible();

    await page.goto('/#/historial/task/HIS-1/99');
    await expect(page.locator('#task-title')).toBeFocused();

    await page.goto('/#/historial/log/2026-01-01');
    await expect(page.getByText('No hay bitácora del 2026-01-01.')).toBeVisible();

    await page.goto('/#/historial/task/HIS-404/1');
    await expect(page.getByRole('alert')).toContainText('HIS-404');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Tablero' })).toBeVisible();
  });

  test('compact width: the history fits at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/#/historial/task/HIS-1/2');
    await expect(page.locator('#entry-2')).toBeFocused();
    await noHorizontalScroll(page);
    await page.goto('/#/historial/log');
    await expect(page.getByRole('link', { name: 'HIS-1 · Filtro con memoria' }).first()).toBeVisible();
    await noHorizontalScroll(page);
  });

  test('accessibility tree of a history entry', async ({ page }) => {
    await page.goto('/#/historial/task/HIS-1');
    await expect(page.locator('#entry-2')).toMatchAriaSnapshot(`
      - article "2026-10-20 09:15":
        - heading "2026-10-20 09:15" [level=3]:
          - time: 2026-10-20 09:15
        - paragraph: "Avanzamos en el filtro: primer paso."
        - list:
          - listitem: "Files: web/app.js"
        - paragraph:
          - link "Ver en la bitácora del 2026-10-20"
    `);
  });

  test('English: history labels are translated', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${E2E_PORTS.en}/#/historial/task/HIS-1`);
    await expect(page.getByRole('heading', { level: 2, name: 'History' })).toBeVisible();
    await expect(page.locator('#entry-1')).toContainText('Task created · origin:');
    await expect(page.getByRole('link', { name: 'See in the log of 2026-10-21' })).toBeVisible();
  });
});

test('the log page shows no stray text and automatic records keep the task link apart', async ({ page }) => {
  await page.goto('/#/historial/log');
  const day = page.locator('#day-2026-10-19').locator('..');
  await expect(day.getByRole('paragraph').filter({ has: page.getByRole('link', { name: 'HIS-1 · Filtro con memoria' }) })).toHaveText('HIS-1 · Filtro con memoria');
  await expect(page.locator('main')).not.toContainText('null');
});

test('closing the task opened from the log goes back to the log', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/historial/log');
  await page.getByRole('link', { name: 'HIS-1 · Filtro con memoria' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Filtro con memoria' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/historial\/log$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('opening and closing a task keeps the board underneath: no reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/historial/board');
  await expect(page.locator('.card').first()).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __board: Element | null; __replaced: number };
    const main = document.getElementById('main')!;
    w.__board = main.firstElementChild;
    w.__replaced = 0;
    new MutationObserver(() => (w.__replaced += 1)).observe(main, { childList: true });
  });
  const unchanged = () => page.evaluate(() => {
    const w = window as unknown as { __board: Element | null; __replaced: number };
    return w.__replaced === 0 && document.getElementById('main')!.firstElementChild === w.__board;
  });
  const card = page.getByRole('link', { name: 'Filtro con memoria' });
  await card.click();
  const dialog = page.getByRole('dialog', { name: 'Filtro con memoria' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.card[aria-current="true"]')).toHaveCount(1);
  expect(await unchanged()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/historial\/board$/);
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
  await expect(page.locator('.card[aria-current="true"]')).toHaveCount(0);
  await card.click();
  await dialog.getByRole('button', { name: 'Cerrar el detalle' }).click();
  await expect(page).toHaveURL(/#\/historial\/board$/);
  await expect(card).toBeFocused();
  expect(await unchanged()).toBe(true);
});
