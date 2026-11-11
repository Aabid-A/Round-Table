import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import type { GameLog } from '../engine/types.js';
import { cardPixels, type CardSize } from '../../web/src/card/params.js';
import { chromiumLaunchOptions } from './browser.js';

export interface RenderCardsInput {
  log: GameLog;
  /** The log's plain name (the card page asks for games/<name>.json). */
  name: string;
  turnId: number;
  sizes: readonly CardSize[];
  outDir: string;
}

const WEB_ROOT = fileURLToPath(new URL('../../web', import.meta.url));

/**
 * Render each size of the card page to a PNG with Playwright. Starts the web app's dev server on a free port
 * and serves the log from memory, so nothing is copied into web/public. Returns the files written.
 */
export async function renderCards(input: RenderCardsInput): Promise<string[]> {
  mkdirSync(input.outDir, { recursive: true });
  const server = await createServer({
    root: WEB_ROOT,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) {
    await server.close();
    throw new Error('could not start the web server for rendering');
  }
  const browser = await chromium.launch(chromiumLaunchOptions());
  const written: string[] = [];
  try {
    for (const size of input.sizes) {
      const { width, height } = cardPixels(size);
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light' });
      try {
        const page = await context.newPage();
        await page.route(`**/games/${input.name}.json`, (route) =>
          route.fulfill({ body: JSON.stringify(input.log), contentType: 'application/json' }),
        );
        await page.goto(`${url}?card=${input.turnId}&log=${encodeURIComponent(input.name)}&size=${size}`);
        await page.locator('.card-page[data-ready="true"], [role="alert"]').first().waitFor({ timeout: 30_000 });
        const alert = page.getByRole('alert');
        if (await alert.count()) throw new Error(await alert.innerText());
        const file = join(input.outDir, `${input.name}-turn-${input.turnId}-${size}.png`);
        await page.getByTestId('card').screenshot({ path: file });
        written.push(file);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return written;
}
