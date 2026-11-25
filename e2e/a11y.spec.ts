import { expect, test, type Page } from '@playwright/test';
import { E2E_PORTS, type E2ELang } from './paths.ts';

// WAY-28: fixes of the accessibility audit (WAYF-12), each checked in Spanish and in English.
const base = (lang: E2ELang) => `http://127.0.0.1:${E2E_PORTS[lang]}`;
const TEXT = {
  es: { skip: 'Saltar al contenido', project: 'Proyecto' },
  en: { skip: 'Skip to content', project: 'Project' },
} as const;

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
  });
}
