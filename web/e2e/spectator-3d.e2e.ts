import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120_000);
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

const FIXTURE = 'tests/fixtures/sample-game.json';
// In the sample game Bram and Cleo are the traitors; everyone else is faithful.

async function open(page: Page, query: string): Promise<void> {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?log=sample&quality=low${query}`);
  await expect(page.getByTestId('world').locator('canvas')).toBeVisible({ timeout: 60_000 });
}

async function walkTo(page: Page, title: string): Promise<void> {
  await page.getByRole('slider', { name: 'Step' }).focus();
  for (let i = 0; i < 90 && !(await page.getByTestId('section').innerText()).startsWith(title); i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('section')).toContainText(title);
}

test('the all-seeing room plays in 3D: every role above its seat, two traitors, filmed by the director', async ({ page }) => {
  await open(page, '&view=spectator');
  const world = page.getByTestId('world');
  await expect(page.locator('main')).toHaveAttribute('data-view', 'spectator');
  await expect(world).toHaveAttribute('data-first', 'false');
  await expect(world).toHaveAttribute('data-roles', '8');
  await expect(world).toHaveAttribute('data-traitors', '2');
  await expect(world.locator('canvas')).toHaveAttribute('data-shot', /.+/, { timeout: 30_000 });
});

test('whispers are lines between seats, and the speaker’s private notes are in the room', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Whispers');
  // Not every player whispers: step on to the first whisper sent.
  for (let i = 0; i < 8 && (await page.getByTestId('world').getAttribute('data-whispers')) !== '1'; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('world')).toHaveAttribute('data-whispers', '1');
  await expect(page.getByTestId('announcement')).toContainText('Whisper from');
  await walkTo(page, 'Round table');
  await expect(page.getByTestId('world')).toHaveAttribute('data-thought', 'shown');
  await expect(page.getByTestId('world').locator('canvas')).toHaveAttribute('data-thinker', /^[0-7]$/, { timeout: 15_000 });
});

test('A comes back to the all-seeing room from a seat, and a seat shows no roles of the living', async ({ page }) => {
  await open(page, '&seat=Aria');
  await expect(page.getByTestId('world')).toHaveAttribute('data-roles', '0');
  await expect(page.getByTestId('world')).toHaveAttribute('data-whispers', '0');
  await page.keyboard.press('a');
  await expect(page.locator('main')).toHaveAttribute('data-view', 'spectator');
  await expect(page.getByTestId('world')).toHaveAttribute('data-roles', '8');
});
