import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

const FIXTURE = 'tests/fixtures/sample-game.json';

async function open(page: Page, query: string): Promise<void> {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?mode=record&log=sample&quality=low${query}`);
}

test('the public clip is filmed in the 3D room, with no controls and no caption laid over it, and plays to the end', async ({ page }) => {
  await open(page, '&from=10&to=13&speed=20');
  const world = page.getByTestId('world');
  await expect(world.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world).toHaveAttribute('data-first', 'false');
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('caption')).toHaveCount(0);
  await expect(page.locator('.rec[data-done="true"]')).toBeVisible({ timeout: 90_000 });
});

for (const [aspect, ratio] of [['16x9', 16 / 9], ['9x16', 9 / 16]] as const) {
  test(`two seats in ${aspect}: two rooms, each from its own chair, at the same moment`, async ({ page }) => {
    await open(page, `&aspect=${aspect}&seats=Aria,Bram&speed=0.05&from=14&to=30`);
    const worlds = page.getByTestId('world');
    await expect(worlds).toHaveCount(2, { timeout: 60_000 });
    for (const w of await worlds.all()) {
      await expect(w.locator('canvas')).toBeVisible({ timeout: 60_000 });
      await expect(w).toHaveAttribute('data-first', 'true');
    }
    await expect(worlds.nth(0)).toHaveAttribute('aria-label', "The room from Aria's chair");
    await expect(worlds.nth(1)).toHaveAttribute('aria-label', "The room from Bram's chair");
    const box = (await page.getByTestId('stage').boundingBox())!;
    expect(Math.abs(box.width / box.height - ratio)).toBeLessThan(0.02);
  });
}

test('the all-seeing clip shows the role over every living player’s seat', async ({ page }) => {
  await open(page, '&view=spectator&speed=0.05&from=14&to=30');
  const world = page.getByTestId('world');
  await expect(world.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world).toHaveAttribute('data-first', 'false');
  // By turn 14 the first night's victim is gone: every one of the seven still in the game has a role over them.
  await expect(world).toHaveAttribute('data-roles', '7');
  await expect(world).toHaveAttribute('data-figures', '7');
});

test('a seat’s clip never shows a living player’s hidden role', async ({ page }) => {
  // Dax is a faithful in the sample game: from his chair only roles made public may show.
  await open(page, '&seat=Dax&speed=0.05&from=14&to=30');
  const world = page.getByTestId('world');
  await expect(world.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world).toHaveAttribute('data-first', 'true');
  await expect(world).toHaveAttribute('data-roles', '0');
});
