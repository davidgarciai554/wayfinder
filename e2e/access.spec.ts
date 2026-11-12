import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startServer, type RunningServer } from '../src/server.ts';
import { E2E_HOME, e2eKeyFile, E2E_PORTS } from './paths.ts';

// Plan 2026-11-11 (WAY-6), increment 5: access page, «Abrir en otro dispositivo», enabling writes
// on this PC, «sin conexión» vs «sin acceso», and 44 px targets on tablets.
const BOARD = '/#/escritura/board';
const webDir = fileURLToPath(new URL('../web', import.meta.url));
/** A non-internal IPv4 of this machine plays the "other device" address without leaving it. */
const lan = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
const SESSION_PORT = 4557;

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, 'no horizontal page scroll').toBeLessThanOrEqual(client);
}

test.describe('access and other devices', () => {
  test('on this PC the read-only notice enables writing in one click, and the panel explains webHost', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(BOARD);
    const panel = page.locator('#share');
    await expect(panel.getByText('Abrir en otro dispositivo')).toBeVisible();
    await panel.getByText('Abrir en otro dispositivo').click();
    await expect(panel.getByText(/solo está abierta en este PC.*webHost/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Activar la escritura en este PC' }).click();
    await expect(page).toHaveURL(`http://127.0.0.1:${E2E_PORTS.es}/`);
    await page.goto(BOARD);
    await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activar la escritura en este PC' })).toHaveCount(0);
  });

  test('a link of an earlier session or a wrong key gets an accessible access page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const gen = readFileSync(e2eKeyFile('es'), 'utf8').split('.')[0];
    const other = gen === 'aaaaaa' ? 'bbbbbb' : 'aaaaaa';
    const expired = await page.goto(`/?k=${other}.${'0'.repeat(48)}`);
    expect(expired?.status()).toBe(401);
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso a Wayfinder' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(/Este enlace ya no es válido: es de una sesión anterior\. Escribe a Claude «abre Wayfinder»/);
    await noHorizontalScroll(page);
    await expect(page.locator('main')).toMatchAriaSnapshot(`
      - main:
        - heading "Acceso a Wayfinder" [level=1]
        - alert: /Este enlace ya no es válido/
    `);
    await page.goto(`/?k=${gen}.${'0'.repeat(48)}`);
    await expect(page.getByRole('alert')).toHaveText(/La clave de este enlace no es correcta/);
  });

  test('tablets get 44 px targets; phones keep the panel without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BOARD);
    await expect(page.getByRole('heading', { level: 1, name: 'escritura' })).toBeVisible();
    for (const selector of ['.tabs a', '#project-select', '.share summary', '.button']) {
      for (const box of await page.locator(selector).filter({ visible: true }).evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height))) {
        expect(box, `${selector} is at least 44 px tall`).toBeGreaterThanOrEqual(44);
      }
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.locator('#share summary').click();
      await noHorizontalScroll(page);
      await page.locator('#share summary').click();
    }
  });

  test.describe('with a second address (session web on the network)', () => {
    test.skip(!lan, 'no non-internal IPv4 interface');
    let server: RunningServer | undefined;
    test.afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    test('copy the link with the keyboard, open it on the other device, then: offline, and expired after a new session', async ({ browser }) => {
      server = await startServer({ home: E2E_HOME, lang: 'es', port: SESSION_PORT, webDir, remoteHost: lan });
      const local = `http://127.0.0.1:${SESSION_PORT}`;
      const remoteLink = server.remoteUrl as string;

      // This PC: the panel shows the link; copying works with the keyboard.
      const pc = await browser.newContext();
      await pc.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: local });
      const page = await pc.newPage();
      await page.goto(`${local}${BOARD}`);
      await page.locator('#share summary').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Enlace para otros dispositivos')).toHaveValue(remoteLink);
      await expect(page.getByText(/El tráfico no va cifrado/)).toBeVisible();
      await page.getByRole('button', { name: 'Copiar enlace' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#share-status')).toHaveText('Enlace copiado.');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(remoteLink);

      // The other device: without the link nothing is readable; with it, the board works and has no panel.
      const phone = await browser.newContext({ viewport: { width: 390, height: 800 } });
      const mobile = await phone.newPage();
      const remoteBase = remoteLink.split('?')[0];
      await mobile.goto(remoteBase);
      await expect(mobile.getByRole('alert')).toHaveText(/Esta web necesita la clave de su enlace/);
      await mobile.goto(remoteLink);
      await mobile.goto(`${remoteBase}${BOARD.slice(1)}`);
      await expect(mobile.getByRole('heading', { level: 1, name: 'escritura' })).toBeVisible();
      await expect(mobile.locator('#share')).toBeHidden();
      await noHorizontalScroll(mobile);

      // Opening the link from another site (here, the PC's own page) is a cross-site navigation:
      // the key cookie must survive the redirect to `/` (it did not with SameSite=Strict).
      const linked = await browser.newContext();
      const fromPage = await linked.newPage();
      await fromPage.goto(`${local}${BOARD}`);
      await fromPage.evaluate((url) => { location.href = url; }, remoteLink);
      await expect(fromPage).toHaveURL(`${remoteBase}`);
      await expect(fromPage.getByRole('heading', { level: 1, name: 'Acceso a Wayfinder' })).toHaveCount(0);
      await expect(fromPage.locator('main')).not.toContainText('Cargando');
      await linked.close();

      // The session ends: "sin conexión" names the likely cause.
      await server.close();
      await expect(mobile.locator('#banner')).toContainText('Puede que la sesión de Claude que abrió la web haya terminado');

      // A new session on the same port: the old link and cookie are reported as expired.
      server = await startServer({ home: E2E_HOME, lang: 'es', port: SESSION_PORT, webDir, remoteHost: lan });
      await expect(mobile.getByRole('heading', { level: 1, name: 'Acceso a Wayfinder' })).toBeVisible({ timeout: 15_000 });
      await expect(mobile.getByRole('alert')).toHaveText(/Este enlace ya no es válido/);
      await pc.close();
      await phone.close();
    });
  });
});
