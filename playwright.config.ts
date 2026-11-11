import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const PORT = 5183;
// The cloud sandbox ships Chromium here. On your own machine run `npx playwright install chromium` once.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'web/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    launchOptions: existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {},
  },
  webServer: {
    command: `npx vite web --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
