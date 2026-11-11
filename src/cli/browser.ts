import { existsSync } from 'node:fs';

/** The cloud sandbox ships Chromium here. On your own machine run `npx playwright install chromium` once. */
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';

/** Launch options for Playwright's Chromium. CHROMIUM_PATH overrides; otherwise the sandbox copy if present. */
export function chromiumLaunchOptions(): { executablePath?: string } {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv) return { executablePath: fromEnv };
  return existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {};
}
