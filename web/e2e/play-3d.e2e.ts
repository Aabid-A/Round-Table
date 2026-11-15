import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

// Seeds (practice AIs are seeded), with the human named Sam: 5 = faithful; 1 = traitor whose first turn is a night turn.
const FAITHFUL = 5;
const TRAITOR = 1;

async function startSolo(page: Page, seed: number): Promise<void> {
  await page.goto(`/?mode=play&seed=${seed}&quality=low`);
  await page.getByLabel(/Your name at the table/).fill('Sam');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible();
}

const form = (page: Page) => page.getByTestId('turn-form');
const world = (page: Page) => page.getByTestId('world');

test('a solo game plays in the 3D room, from your own chair, and draws', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world(page)).toHaveAttribute('data-first', 'true');
  await page.waitForTimeout(1500);
  expect((await world(page).locator('canvas').screenshot()).length).toBeGreaterThan(20_000);
});

test('you choose in the room with the keys: the arrows move the choice, Enter sends the turn', async ({ page }) => {
  // A traitor's first turn is the night: choosing a seat is the whole answer.
  await startSolo(page, TRAITOR);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(form(page)).toHaveAttribute('data-phase', 'night');
  await expect(world(page)).not.toHaveAttribute('data-choosable', '0');
  const before = Number(await form(page).getAttribute('data-turn'));
  // In the box of what you know (which scrolls), the arrows are the box's, not the room's.
  await form(page).getByLabel('What you know so far').focus();
  await page.keyboard.press('ArrowRight');
  await expect(world(page)).toHaveAttribute('data-selected', '');
  // Out of the box, the arrows choose in the room.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ArrowRight');
  await expect(world(page)).toHaveAttribute('data-selected', /\d/);
  await expect(page.getByTestId('live-chosen')).toContainText('You chose');
  // The form takes the choice a moment after the room shows it; Confirm being ready is what a player sees.
  await expect(page.getByTestId('live-send')).toBeEnabled();
  await page.keyboard.press('Enter');
  // The turn is sent: the next turn opens (turn numbers count every player's turns, so it is not simply one more).
  await expect(form(page)).not.toHaveAttribute('data-turn', String(before), { timeout: 90_000 });
});

test('a traitor’s night shows the proposals on the table and offers only faithfuls', async ({ page }) => {
  await startSolo(page, TRAITOR);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(form(page)).toHaveAttribute('data-phase', 'night');
  const offered = await form(page).locator('input[type=radio]').count();
  await expect(world(page)).toHaveAttribute('data-choosable', String(offered));
});

test('with reduced motion the solo seat shows its flat room, not the 3D one', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?mode=play&seed=${FAITHFUL}`);
  await page.getByLabel(/Your name at the table/).fill('Sam');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible();
  await expect(page.getByTestId('room')).toBeVisible();
  await expect(world(page)).toHaveCount(0);
});

test('a faithful sees no proposals, and the room speaks to a screen reader', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world(page)).toHaveAttribute('data-proposals', '0');
  await expect(page.getByTestId('room-announcement')).not.toBeEmpty();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the room sits above Confirm and never takes its tap', async ({ page }) => {
    await startSolo(page, FAITHFUL);
    await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(form(page)).toHaveAttribute('data-phase', 'whispers');
    const roomBox = (await world(page).boundingBox())!;
    const confirmBox = (await page.getByTestId('live-confirm').boundingBox())!;
    expect(roomBox.y + roomBox.height).toBeLessThanOrEqual(confirmBox.y);
    const before = await form(page).getAttribute('data-turn');
    await form(page).getByLabel('Send no whisper').check();
    await expect(page.getByTestId('live-send')).toBeEnabled();
    await page.getByTestId('live-send').tap({ timeout: 10_000 });
    await expect(form(page)).not.toHaveAttribute('data-turn', before ?? '', { timeout: 90_000 });
  });
});
