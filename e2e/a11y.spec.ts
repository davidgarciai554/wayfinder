import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { e2eHome, e2eKeyFile, E2E_PORTS, type E2ELang } from './paths.ts';

// WAY-28: fixes of the accessibility audit (WAYF-12), each checked in Spanish and in English.
const base = (lang: E2ELang) => `http://127.0.0.1:${E2E_PORTS[lang]}`;
const TEXT = {
  es: { skip: 'Saltar al contenido', project: 'Proyecto', board: 'Tablero', errors: 'Errores', done: 'Hechas', oneChange: 'Actualizado · 1 cambio' },
  en: { skip: 'Skip to content', project: 'Project', board: 'Board', errors: 'Errors', done: 'Done', oneChange: 'Updated · 1 change' },
} as const;

/** Generated English text (fixed labels of history, error notes and log) that is not inside lang="en". */
const unmarkedEnglish = (page: Page, selector: string) => page.locator(selector).evaluateAll((roots) => {
  const english = /status: \S+ -> |\b(Files|Next|Decisions|Blockers):|\b(Resolved|Updated|Reopened|Discarded)\.|Created \(task:|trivial: true/;
  const found: string[] = [];
  let marked = 0;
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!english.test(node.textContent ?? '')) continue;
      if (node.parentElement?.closest('[lang="en"]')) marked += 1;
      else found.push(node.textContent ?? '');
    }
  }
  return { marked, found };
});

/** The focused element is the first control inside <main>. */
const focusOnFirstControl = (page: Page) => page.evaluate(() => {
  const main = document.querySelector('main')!;
  const first = main.querySelector('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex="0"]');
  return first !== null && document.activeElement === first;
});

for (const lang of ['es', 'en'] as const) {
  test.describe(`accessibility fixes (${lang})`, () => {
    test('A11Y-1: the skip link moves focus to the content and keeps the view', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const route of ['#/wayfinder/board', '#/errores/errors/ERR-1']) {
        // A fresh document each time: a hash-only goto would keep the focus where it was.
        await page.goto('about:blank');
        await page.goto(`${base(lang)}/${route}`);
        const heading = page.locator('main h1');
        await expect(heading).toBeVisible();
        const title = await heading.textContent();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: TEXT[lang].skip })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
        expect(new URL(page.url()).hash).toBe(route);
        await expect(heading).toHaveText(title ?? '');
        await expect(page.locator('#project-select')).toBeVisible();
        await page.keyboard.press('Tab');
        expect(await focusOnFirstControl(page)).toBe(true);
      }
    });

    test('A11Y-2: the arrows walk the project picker without losing the focus', async ({ page }) => {
      await page.goto(`${base(lang)}/#/bloqueos/board`);
      await expect(page.locator('main h1')).toBeVisible();
      const picker = page.getByRole('combobox', { name: TEXT[lang].project, exact: true });
      const slugs = await picker.locator('option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
      const start = slugs.indexOf('bloqueos');
      await picker.focus();
      for (const step of [1, 2]) {
        await page.keyboard.press('ArrowDown');
        const slug = slugs[start + step];
        await expect(page).toHaveURL(new RegExp(`#/${slug}/board$`));
        await expect(page.locator('main h1')).toHaveText(await picker.locator(`option[value="${slug}"]`).innerText());
        await expect(picker).toBeFocused();
        await expect(picker).toHaveValue(slug);
      }
    });
    test('A11Y-3: the page title names the view and the project', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${base(lang)}/#/wayfinder/board`);
      await expect(page).toHaveTitle(`${TEXT[lang].board} · wayfinder · Wayfinder`);
      await page.getByRole('link', { name: 'Añadir filtro por prioridad al tablero' }).click();
      await expect(page).toHaveTitle('Añadir filtro por prioridad al tablero · wayfinder · Wayfinder');
      await page.goto(`${base(lang)}/#/errores/errors/ERR-1`);
      await expect(page).toHaveTitle('El bundle falla con require dinámico <img src=x onerror=window.__xss=6> · errores · Wayfinder');
      await page.goto(`${base(lang)}/#/errores/errors`);
      await expect(page).toHaveTitle(`${TEXT[lang].errors} · errores · Wayfinder`);
    });

    test('A11Y-5: Back from an error returns the focus to its link, or to its group while folded', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${base(lang)}/#/errores/errors`);
      const link = page.locator('[data-focus="error:ERR-1"]');
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#\/errores\/errors\/ERR-1$/);
      await expect(page.locator('#error-title')).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/#\/errores\/errors$/);
      await expect(link).toBeFocused();

      // ERR-2 is among the oldest resolved errors, folded under «see all».
      await expect(page.locator('[data-focus="error:ERR-2"]')).toHaveCount(0);
      await page.goto(`${base(lang)}/#/errores/errors/ERR-2`);
      await expect(page.locator('#error-title')).toBeVisible();
      await page.goBack();
      await expect(page.locator('#errors-resolved')).toBeFocused();
    });

    test('A11Y-8: the Done heading counts every done task, like its jump link', async ({ page }) => {
      await page.goto(`${base(lang)}/#/wayfinder/board`);
      await expect(page.locator('#column-done .card')).toHaveCount(10);
      await expect(page.getByRole('heading', { level: 2, name: `${TEXT[lang].done} 12` })).toBeVisible();
      await expect(page.locator('.jump a').last()).toHaveText(`${TEXT[lang].done} (12)`);
    });
    test('A11Y-6: the project page goes from h1 to h2 without a gap', async ({ page }) => {
      await page.goto(`${base(lang)}/#/wayfinder/project`);
      await expect(page.locator('main').getByText('Gestor de tareas en Markdown.')).toBeVisible();
      const headings = await page.locator('main :is(h1, h2, h3, h4, h5, h6)').evaluateAll((list) => list.map((h) => `${h.tagName}: ${h.textContent}`));
      expect(headings).toEqual(['H1: wayfinder', 'H2: Qué es']);
    });
    test('A11Y-4: generated English text carries lang="en", and one change is singular', async ({ page }) => {
      for (const [route, selector] of [['#/historial/task/HIS-1', '#task-dialog .history'], ['#/errores/errors/ERR-2', '#error-history + .entries'], ['#/wayfinder/log', 'main .days']]) {
        await page.goto(`${base(lang)}/${route}`);
        await expect(page.locator(selector).first()).toBeVisible();
        const { marked, found } = await unmarkedEnglish(page, selector);
        expect(found, route).toEqual([]);
        expect(marked, route).toBeGreaterThan(0);
      }

      await page.goto(`${base(lang)}/#/demo-app/board`);
      await expect(page.locator('main h1')).toBeVisible();
      // One external change: the same bytes written again still count as a change of the file.
      const dir = join(e2eHome(lang), 'projects', 'demo-app');
      const file = join(dir, readdirSync(dir).find((name) => name.endsWith('.md'))!);
      writeFileSync(file, readFileSync(file));
      await expect(page.locator('#live-text')).toHaveText(TEXT[lang].oneChange, { timeout: 5000 });
    });
    test('A11Y-7: on a phone the jump links are 44 px high and the whole card opens its task', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base(lang)}/#/wayfinder/board`);
      const jumps = page.locator('.jump a');
      await expect(jumps).toHaveCount(4);
      for (const box of await jumps.evaluateAll((links) => links.map((a) => a.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);

      // The tap area of the title link is the whole card.
      const card = page.locator('.card').filter({ has: page.getByRole('link', { name: 'Añadir filtro por prioridad al tablero' }) });
      const [cardBox, area] = await card.evaluate((node) => {
        const after = getComputedStyle(node.querySelector('.card-title')!, '::after');
        return [node.getBoundingClientRect().height, after.position];
      });
      expect(cardBox).toBeGreaterThanOrEqual(44);
      expect(area).toBe('absolute');
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      await page.mouse.click(box.x + box.width - 8, box.y + box.height - 6);
      await expect(page).toHaveURL(/#\/wayfinder\/task\/WF-3$/);
      await expect(page.locator('#task-title')).toBeFocused();

      // With writing on, the card's buttons stay on top of that area (nothing is clicked here).
      await page.goto(`${base(lang)}/?k=${readFileSync(e2eKeyFile(lang), 'utf8')}`);
      await page.goto(`${base(lang)}/#/wayfinder/board`);
      const button = page.locator('.card-actions button').first();
      await button.scrollIntoViewIfNeeded();
      expect(await button.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node;
      })).toBe(true);
    });
  });
}
