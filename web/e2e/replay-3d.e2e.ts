import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120_000);
// The sandbox renders WebGL in software (SwiftShader); a machine with a GPU needs no flags. ?quality= skips the frame-time probe.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

const FIXTURE = 'tests/fixtures/sample-game.json';
// In the sample game Aria is faithful and Bram and Cleo are the traitors.

async function open(page: Page, query = ''): Promise<void> {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?log=sample&quality=low${query}`);
  await expect(page.getByTestId('world').locator('canvas')).toBeVisible({ timeout: 60_000 });
}

async function stepTo(page: Page, n: number): Promise<void> {
  await page.getByRole('slider', { name: 'Step' }).focus();
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight');
}

test('the public table plays in the 3D room: eight figures, filmed by the director, and it draws', async ({ page }) => {
  await open(page);
  const world = page.getByTestId('world');
  await expect(world).toHaveAttribute('data-figures', '8');
  await expect(world).toHaveAttribute('data-first', 'false');
  await expect(world.locator('canvas')).toHaveAttribute('data-shot', /.+/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect((await world.locator('canvas').screenshot()).length).toBeGreaterThan(20_000);
  // The flat table is not drawn as well.
  await expect(page.getByTestId('table')).toHaveCount(0);
});

test('the keys still step it, the live region still speaks, and dawn leaves seven at the table', async ({ page }) => {
  await open(page);
  await stepTo(page, 5);
  await expect(page.getByTestId('section')).toContainText('Breakfast');
  await expect(page.getByTestId('announcement')).toContainText('Esme');
  await expect(page.getByTestId('world')).toHaveAttribute('data-figures', '7');
  await stepTo(page, 8);
  await expect(page.getByTestId('section')).toContainText('Round table');
  await expect(page.getByTestId('world').locator('canvas')).toHaveAttribute('data-speaker', /^[0-7]$/, { timeout: 15_000 });
});

test('the View list sits you in a chair, in the first person, and back at the table', async ({ page }) => {
  await open(page);
  await page.getByLabel('View').selectOption('Aria');
  await expect(page.locator('main')).toHaveAttribute('data-seat', 'Aria');
  await expect(page.getByTestId('world')).toHaveAttribute('data-first', 'true');
  expect(page.url()).toContain('seat=Aria');
  await page.getByLabel('View').selectOption('');
  await expect(page.getByTestId('world')).toHaveAttribute('data-first', 'false');
});

test('clicking a figure in the room sits you in that seat', async ({ page }) => {
  await open(page, '&seat=Aria');
  const canvas = page.getByTestId('world').locator('canvas');
  const box = (await canvas.boundingBox())!;
  // The seat straight across the table is in the middle of the picture, a little above the middle.
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.4;
  await page.mouse.move(x, y, { steps: 4 });
  await page.waitForTimeout(2500);
  await page.mouse.click(x, y);
  await expect(page.locator('main')).not.toHaveAttribute('data-seat', 'Aria', { timeout: 15_000 });
  await expect(page.locator('main')).toHaveAttribute('data-seat', /\w+/);
});

test('seated as a faithful, nothing on the page names a traitor before the game reveals one', async ({ page }) => {
  await open(page, '&seat=Aria');
  for (let i = 0; i < 24; i++) {
    expect((await page.locator('body').innerText()).toLowerCase(), `step ${i}`).not.toContain('traitor');
    await page.keyboard.press('ArrowRight');
  }
});

test('a banishment is staged beat by beat: the room shows seven, then the mask', async ({ page }) => {
  await open(page);
  await stepTo(page, 36);
  await expect(page.getByTestId('section')).toContainText('Banishment');
  // Never the result before the moment: first the chair, and the role only once the mask is turned over.
  await expect(page.getByTestId('announcement')).toContainText("Aria's chair is pushed back");
  await expect(page.getByTestId('announcement')).not.toContainText('faithful');
  await expect(page.getByTestId('world')).toHaveAttribute('data-figures', '6', { timeout: 15_000 });
  await expect(page.getByTestId('announcement')).toContainText('faithful', { timeout: 15_000 });
});
