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
  await expect(page.getByRole('form', { name: 'Choose a figure' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'pointed');
  await expect(page.locator('.slice-caption')).toContainText('You point at');
  await toNextChoice(page);
  await expect(page.getByTestId('slice')).toHaveAttribute('data-stage', 'vote');
  await page.getByRole('radio').nth(1).check();
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
