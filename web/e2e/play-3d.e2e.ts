import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

// Seeds (practice AIs are seeded), with the human named Sam: 5 = faithful; 1 = traitor whose first turn is a night turn.
const FAITHFUL = 5;
const TRAITOR = 1;

/** Sit down in the game shell: the name on the plate, Take your seat, then past the role reveal to the first turn. */
async function startSolo(page: Page, seed: number): Promise<void> {
  await page.goto(`/?mode=play&seed=${seed}&quality=low`);
  await page.getByTestId('setup-name').fill('Sam');
  await page.getByTestId('take-seat-start').click();
  await page.getByTestId('take-seat').click({ timeout: 60_000 });
  await expect(page.getByTestId('turn-form')).toBeAttached({ timeout: 60_000 });
}

const form = (page: Page) => page.getByTestId('turn-form');
const world = (page: Page) => page.getByTestId('world');
const bar = (page: Page) => page.getByTestId('inputbar');

test('a solo game plays in the 3D room, full screen, from your own chair, and draws', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world(page)).toHaveAttribute('data-first', 'true');
  // The room fills the window: no page title, nothing to scroll.
  const box = (await world(page).boundingBox())!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 1280, 720]);
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Take a seat' })).toBeHidden();
  await page.waitForTimeout(1500);
  expect((await world(page).locator('canvas').screenshot()).length).toBeGreaterThan(20_000);
});

test('the title screen in the hall leads to play, rooms and episodes; the addresses still work', async ({ page }) => {
  await page.goto('/?quality=low');
  await expect(page.getByRole('heading', { level: 1, name: 'Round Table' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('canvas')).toHaveAttribute('data-shot', 'drift');
  await expect(page.getByTestId('title-play')).toHaveAttribute('href', '?mode=play');
  await expect(page.getByTestId('title-friends')).toHaveAttribute('href', '?mode=room');
  await expect(page.getByTestId('title-watch')).toHaveAttribute('href', '?page=episodes');
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('setup-name')).toBeVisible();
});

test('the setup is at the table: your name on the plate, practice AIs by default, real models behind one control', async ({ page }) => {
  await page.goto(`/?mode=play&seed=${FAITHFUL}&quality=low`);
  await expect(page.getByTestId('setup-name')).toHaveValue('Sam');
  await expect(page.getByTestId('keypanel')).toHaveCount(0);
  await page.getByTestId('use-real').click();
  await expect(page.getByTestId('keypanel')).toBeVisible();
  await expect(page.getByTestId('key-note')).toContainText('never saved');
  await page.getByTestId('use-real').click();
  await expect(page.getByTestId('keypanel')).toHaveCount(0);
  await page.getByTestId('setup-name').fill('');
  await page.getByTestId('take-seat-start').click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('your role is told with your mask in your hands, and held until you take your seat', async ({ page }) => {
  await page.goto(`/?mode=play&seed=${TRAITOR}&quality=low`);
  await page.getByTestId('setup-name').fill('Sam');
  await page.getByTestId('take-seat-start').click();
  await expect(page.getByTestId('take-seat')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/You are a traitor\. Your partner: \w+\./)).toBeAttached();
  await expect(bar(page)).toHaveCount(0);
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('take-seat')).toBeVisible();
  await page.getByTestId('take-seat').click();
  await expect(bar(page)).toBeVisible();
});

test('you choose in the room with the keys: the arrows move the choice, Enter sends; no Confirm, no fields below the room', async ({ page }) => {
  // A traitor's first turn is the night: choosing a figure is the whole answer.
  await startSolo(page, TRAITOR);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(form(page)).toHaveAttribute('data-phase', 'night');
  await expect(page.getByTestId('live-send')).toHaveCount(0);
  await expect(form(page)).toBeHidden(); // folded away: the screen reader's path
  const before = Number(await form(page).getAttribute('data-turn'));
  // In the journal (which scrolls), the arrows are the journal's, not the room's.
  await page.keyboard.press('j');
  await expect(page.getByTestId('journal')).toHaveAttribute('data-open', 'true');
  await page.getByTestId('journal').getByLabel('What you know so far').focus();
  await page.keyboard.press('ArrowRight');
  await expect(world(page)).toHaveAttribute('data-selected', '');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('journal')).toHaveAttribute('data-open', 'false');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ArrowRight');
  await expect(world(page)).toHaveAttribute('data-selected', /\d/);
  await expect(page.getByTestId('inputbar-chosen')).not.toBeEmpty();
  await expect(page.getByTestId('inputbar-send')).toBeEnabled();
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

test('with reduced motion the solo seat shows its flat room and the plain setup, not the shell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/?mode=play&seed=${FAITHFUL}`);
  await page.getByLabel(/Your name at the table/).fill('Sam');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible();
  await expect(page.getByTestId('room')).toBeVisible();
  await expect(world(page)).toHaveCount(0);
  await expect(page.getByTestId('shell')).toHaveCount(0);
});

test('a faithful sees no proposals, and the room speaks to a screen reader', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world(page)).toHaveAttribute('data-proposals', '0');
  await expect(page.getByTestId('room-announcement')).not.toBeEmpty();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the shell fills the screen and nothing covers Send', async ({ page }) => {
    await startSolo(page, FAITHFUL);
    await expect(world(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(form(page)).toHaveAttribute('data-phase', 'whispers');
    const box = (await world(page).boundingBox())!;
    expect([box.width, box.height]).toEqual([390, 844]);
    const before = await form(page).getAttribute('data-turn');
    await page.getByTestId('inputbar-none').tap();
    const send = page.getByTestId('inputbar-send');
    await expect(send).toBeEnabled();
    // The button is the topmost thing where it is drawn: no canvas or panel lies over it.
    const top = await send.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el && r.bottom <= window.innerHeight;
    });
    expect(top).toBe(true);
    await send.tap({ timeout: 60_000 });
    await expect(form(page)).not.toHaveAttribute('data-turn', before ?? '', { timeout: 90_000 });
  });
});
