import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.setTimeout(180_000);
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

const FIXTURE = 'tests/fixtures/sample-game.json';
const log = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { turns: { id: number; phase: string; player: string }[] };
const turn = log.turns.find((t) => t.phase === 'round_table')!;

for (const [size, w, h] of [['1200x675', 1200, 675], ['1080x1350', 1080, 1350]] as const) {
  test(`the ${size} card shows the moment in the room, keeps its size, and is ready only once the picture is drawn`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
    await page.goto(`/?card=${turn.id}&log=sample&size=${size}&quality=low`);
    const shot = page.getByTestId('card-shot');
    await expect(shot.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.card-page[data-ready="true"]')).toBeVisible({ timeout: 90_000 });
    const box = (await page.getByTestId('card').boundingBox())!;
    expect([box.width, box.height]).toEqual([w, h]);
    // The name is over the picture; the quotes are still all there.
    await expect(page.getByRole('heading', { level: 1, name: turn.player })).toBeVisible();
    await expect(page.getByTestId('card-said')).toBeVisible();
    await expect(page.getByTestId('card-thought')).toBeVisible();
    expect((await shot.locator('canvas').screenshot()).length).toBeGreaterThan(5_000);
  });
}

test('a card opened with ?fallback=1 is text alone, and ready at once', async ({ page }) => {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?fallback=1&card=${turn.id}&log=sample`);
  await expect(page.locator('.card-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('card-shot')).toHaveCount(0);
});
