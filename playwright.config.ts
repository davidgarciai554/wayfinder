import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT, E2E_PORTS } from './e2e/paths.ts';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: (['es', 'en'] as const).map((lang) => ({
    command: 'node e2e/fixture-server.ts',
    env: { WAYFINDER_LANG: lang },
    url: `http://127.0.0.1:${E2E_PORTS[lang]}/api/projects`,
    reuseExistingServer: false,
    timeout: 60_000,
  })),
});
