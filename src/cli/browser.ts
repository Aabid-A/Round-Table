import { existsSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';

/** The cloud sandbox ships Chromium here. On your own machine run `npx playwright install chromium` once. */
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';

/** Launch options for Playwright's Chromium. CHROMIUM_PATH overrides; otherwise the sandbox copy if present. */
export function chromiumLaunchOptions(): { executablePath?: string } {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv) return { executablePath: fromEnv };
  return existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {};
}

/** Launch Chromium. If it is missing, say how to get it instead of showing Playwright's raw error. */
export async function launchChromium(): Promise<Browser> {
  const options = chromiumLaunchOptions();
  try {
    return await chromium.launch(options);
  } catch (e) {
    const where = options.executablePath ? ` at ${options.executablePath}` : '';
    const detail = e instanceof Error ? e.message.split('\n')[0] : String(e);
    throw new Error(`Could not start Chromium${where}: ${detail}\nRun "npx playwright install chromium", or set CHROMIUM_PATH to a Chromium or Chrome binary.`);
  }
}
