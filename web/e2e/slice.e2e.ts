import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120_000);
// The sandbox renders WebGL in software (SwiftShader); a machine with a GPU needs no flags.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

const stage = (page: Page) => page.getByTestId('slice').getAttribute('data-stage');

/** Skip each timed moment until the page waits for the player (or the end). */
async function toNextChoice(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const s = await stage(page);
    if (s === 'accuse' || s === 'vote' || s === 'end') return;
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(60);
  }
}

test('opens on a lit room with eight figures at a table, and draws something', async ({ page }) => {
  await page.goto('/?mode=slice&quality=low');
  await expect(page.getByTestId('slice').locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('slice')).toHaveAttribute('data-figures', '8');
  await expect(page.getByTestId('slice')).toHaveAttribute('data-quality', 'low');
  await page.waitForTimeout(1500);
  // A blank canvas compresses to a few hundred bytes; a lit room does not.
  const png = await page.getByTestId('slice').locator('canvas').screenshot();
  expect(png.length).toBeGreaterThan(20_000);
});

test('plays the whole slice by keyboard and the choice form: accuse, vote, banishment, night, dawn', async ({ page }) => {
  await page.goto('/?mode=slice&quality=low');
  await expect(page.getByTestId('slice').locator('canvas')).toBeVisible({ timeout: 60_000 });
  await toNextChoice(page);
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'accuse');
  // The list of names is there for a keyboard or a screen reader, but folded away: the choice is made in the room.
  await expect(page.getByRole('form', { name: 'Choose a figure' })).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('slice')).toHaveAttribute('data-selected', '1');
  // Once opened, the list stays open for the next choice.
  await page.getByText('Choose from a list').click();
  await expect(page.getByRole('form', { name: 'Choose a figure' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'pointed');
  await expect(page.locator('.slice-caption')).toContainText('You point at');
  await toNextChoice(page);
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'vote');
  await expect(page.getByRole('form', { name: 'Choose a figure' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  await page.getByRole('radio').nth(1).check();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'tally');
  for (let i = 0; i < 6 && (await stage(page)) !== 'end'; i++) {
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(80);
  }
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'end');
  await expect(page.locator('.slice-caption')).toContainText('The slice is over');
  await page.getByRole('button', { name: 'Sit through it again' }).click();
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'intro');
});

test('no role is named anywhere on the page before a mask is turned over', async ({ page }) => {
  await page.goto('/?mode=slice&quality=low');
  await expect(page.getByTestId('slice').locator('canvas')).toBeVisible({ timeout: 60_000 });
  await toNextChoice(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await toNextChoice(page);
  await page.getByText('Choose from a list').click();
  await page.getByRole('radio').first().check();
  const before = (await page.locator('body').innerText()).toLowerCase();
  expect(before).not.toMatch(/traitor|faithful/);
  await page.getByRole('button', { name: 'Confirm' }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(80);
  }
  await expect(page.locator('.slice-caption')).toContainText(/faithful|traitor/);
});

test('you accuse by looking at a figure in the room and selecting it, twice to confirm', async ({ page }) => {
  await page.goto('/?mode=slice&quality=low');
  await expect(page.getByTestId('slice').locator('canvas')).toBeVisible({ timeout: 60_000 });
  await toNextChoice(page);
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'accuse');
  // No list of names in the way by default.
  await expect(page.getByRole('radio')).toHaveCount(0);
  // The figure straight across the table (seat 4) is in the middle of the picture, a little above the middle.
  const box = (await page.getByTestId('slice').locator('canvas').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.36;
  await page.mouse.move(x, y, { steps: 4 });
  // The head follows the pointer; give it a moment to come round from the Skip button to the middle.
  await page.waitForTimeout(3000);
  await page.mouse.click(x, y);
  await expect(page.getByTestId('slice')).toHaveAttribute('data-selected', '4');
  await expect(page.locator('.slice-caption')).toContainText('is chosen');
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'accuse');
  await page.mouse.click(x, y);
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'pointed');
  await expect(page.locator('.slice-caption')).toContainText('You point at Dax');
});

test('honours reduced motion: the room still draws and plays, and says so', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?mode=slice&quality=low');
  await expect(page.getByTestId('slice').locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('slice')).toHaveAttribute('data-motion', 'reduced');
  await page.waitForTimeout(1500);
  expect((await page.getByTestId('slice').locator('canvas').screenshot()).length).toBeGreaterThan(20_000);
  await toNextChoice(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'pointed');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByTestId('slice')).toHaveAttribute('data-motion', 'full');
});

test('the room reports what a frame costs, and stays inside its budget', async ({ page }) => {
  await page.goto('/?mode=slice&quality=low');
  const canvas = page.getByTestId('slice').locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-calls', /\d+/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  // At low quality there is one pass and no shadows, so this is the scene itself: under 150 draw calls and 200k triangles (/scene-3d).
  expect(Number(await canvas.getAttribute('data-calls'))).toBeLessThan(150);
  expect(Number(await canvas.getAttribute('data-triangles'))).toBeLessThan(200_000);
});

test('if the graphics context is lost, the plain version takes over with the list open', async ({ page }) => {
  await page.goto('/?mode=slice&quality=low');
  const canvas = page.getByTestId('slice').locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await toNextChoice(page);
  await canvas.evaluate((c: HTMLCanvasElement) => (c.getContext('webgl2') ?? c.getContext('webgl'))!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.getByTestId('slice-fallback')).toBeVisible();
  await expect(page.getByTestId('slice-fallback')).toContainText('graphics context was lost');
  await expect(page.getByRole('radio')).toHaveCount(7);
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'pointed');
});

test('the plain version (no WebGL) plays the same round, with the list and a live region', async ({ page }) => {
  await page.goto('/?mode=slice&fallback=1');
  await expect(page.getByTestId('slice-fallback')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'At the table' }).getByRole('listitem')).toHaveCount(8);
  await expect(page.locator('.slice-caption')).toHaveAttribute('aria-live', 'polite');
  // The plain version shows what each figure says (the 3D bubble is not there to carry it).
  await expect(page.locator('.slice-caption')).not.toHaveClass(/sr-only/);
  await expect(page.locator('.slice-caption')).toContainText(/says:/, { timeout: 8000 });
  await toNextChoice(page);
  await page.getByRole('radio').nth(2).check();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.slice-caption')).toContainText('You point at');
  await toNextChoice(page);
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Confirm' }).click();
  for (let i = 0; i < 6 && (await stage(page)) !== 'end'; i++) {
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(60);
  }
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'end');
  await expect(page.getByTestId('slice-fallback').getByText(/was a (faithful|traitor)/)).toHaveCount(2);
});

test('sound starts off until a click, and the mute choice is remembered', async ({ page }) => {
  await page.goto('/?mode=slice&fallback=1');
  const button = page.getByRole('button', { name: /Sound/ });
  await expect(button).toHaveText('Sound on');
  await button.click();
  await expect(button).toHaveText('Sound off');
  await page.reload();
  await expect(page.getByRole('button', { name: /Sound/ })).toHaveText('Sound off');
});

test('the other modes are unchanged', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('slice')).toHaveCount(0);
});
