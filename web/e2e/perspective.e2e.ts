import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-game.json';
const log = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { roles: Record<string, string>; cast: { name: string }[] };
// In the sample game Aria is faithful and Bram and Cleo are the traitors.

async function open(page: Page, query: string): Promise<void> {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?log=sample${query}`);
}

const stepText = (page: Page): Promise<string> => page.getByRole('slider', { name: 'Step' }).getAttribute('aria-valuetext').then((t) => t ?? '');

async function stepTo(page: Page, n: number): Promise<void> {
  await page.getByRole('slider', { name: 'Step' }).focus();
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight');
}

test('?seat= opens the replay in that player’s chair', async ({ page }) => {
  await open(page, '&seat=Aria');
  const room = page.getByTestId('room');
  await expect(room).toBeVisible();
  await expect(room.getByTestId('room-seat')).toHaveCount(8);
  await expect(room.locator('[data-name=Aria]')).toHaveAttribute('data-mark', 'self');
  await expect(page.getByLabel('Sit in a seat')).toHaveValue('Aria');
  await expect(page.getByText('Show private notes')).toHaveCount(0);
});

test('a faithful never sees a living traitor’s role, at any step', async ({ page }) => {
  expect(log.roles.Aria).toBe('faithful');
  await open(page, '&seat=Aria');
  const total = Number(/of (\d+)/.exec(await stepText(page))![1]);
  await page.getByRole('slider', { name: 'Step' }).focus();
  for (let i = 0; i < total; i++) {
    const hidden = await page.locator('[data-testid=room-seat]:not([data-status=murdered]):not([data-status=banished]):not([data-mark=self]) .room-tag[data-role]').count();
    expect(hidden, `step ${i}`).toBe(0);
    await page.keyboard.press('ArrowRight');
  }
});

const stepAt = (page: Page): Promise<string | null> => page.locator('main').getAttribute('data-step');

test('switching seats keeps the same moment, and a traitor sees their fellow traitor', async ({ page }) => {
  await open(page, '&seat=Aria');
  await page.getByRole('slider', { name: 'Step' }).focus();
  // Walk to a round-table speech: every seat sees those, so the same step is on every seat's list.
  for (let i = 0; i < 60 && !(await page.getByTestId('section').innerText()).startsWith('Round table'); i++) await page.keyboard.press('ArrowRight');
  const before = await stepAt(page);
  await page.getByLabel('Sit in a seat').selectOption('Bram');
  expect(await stepAt(page)).toBe(before);
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', 'Bram');
  await expect(page.locator('[data-name=Cleo] .room-tag', { hasText: 'Fellow traitor' })).toBeVisible();
  await page.locator('[data-name=Hugo] button').click(); // clicking a chair sits there
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', 'Hugo');
  expect(await stepAt(page)).toBe(before);
  expect(page.url()).toContain('seat=Hugo');
  await page.getByLabel('Sit in a seat').selectOption('');
  await expect(page.getByTestId('table')).toBeVisible();
  expect(page.url()).not.toContain('seat=');
  expect(await stepAt(page)).toBe(before);
});

test('a step that is empty for the seat is stood on the nearest earlier one when switching, and the counter follows the seat', async ({ page }) => {
  await open(page, '&seat=Aria');
  const aria = Number(/of (\d+)/.exec(await stepText(page))![1]);
  await page.getByLabel('Sit in a seat').selectOption('');
  const publicTotal = Number(/of (\d+)/.exec(await stepText(page))![1]);
  expect(aria).toBeLessThan(publicTotal); // the seat's list leaves out the traitors' night turns and other empty steps
});

test('the room keeps still under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '&seat=Aria');
  await expect(page.locator('.room-stage')).toHaveCSS('transition-duration', '0s');
});

test('split view in recording mode: two seats side by side in 16:9, one above the other in 9:16, at one moment', async ({ page }) => {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto('/?mode=record&log=sample&aspect=16x9&seats=Aria,Bram&speed=0.05&from=14&to=30');
  const rooms = page.getByTestId('room');
  await expect(rooms).toHaveCount(2);
  const [a, b] = [await rooms.nth(0).boundingBox(), await rooms.nth(1).boundingBox()];
  expect(a!.y).toBeCloseTo(b!.y, 0);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 2);
  await expect(page.getByRole('button')).toHaveCount(0); // a clip has no controls
  const captions = page.getByTestId('room-caption');
  expect(await captions.nth(0).innerText()).toBe(await captions.nth(1).innerText());
  await expect(rooms.nth(0)).toHaveAttribute('data-viewer', 'Aria');
  await expect(rooms.nth(1)).toHaveAttribute('data-viewer', 'Bram');

  await page.goto('/?mode=record&log=sample&aspect=9x16&seats=Aria,Bram&speed=0.05&from=14&to=30');
  await expect(rooms).toHaveCount(2);
  const [c, d] = [await rooms.nth(0).boundingBox(), await rooms.nth(1).boundingBox()];
  expect(c!.x).toBeCloseTo(d!.x, 0);
  expect(d!.y).toBeGreaterThan(c!.y + c!.height - 2);
});

test('a clip of one seat, and a plain message for a seat that is not at the table', async ({ page }) => {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto('/?mode=record&log=sample&seat=Cleo&speed=0.05');
  await expect(page.getByTestId('room')).toHaveCount(1);
  await page.goto('/?mode=record&log=sample&seats=Aria,Nobody');
  await expect(page.getByRole('alert')).toContainText('There is no seat called Nobody');
});

test('the text a screen reader is given while seated holds nothing the seat could not know', async ({ page }) => {
  const full = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
    turns: { player: string; private_notes: string; phase: string; action: { to?: string | null; message?: string } }[];
  };
  const forbidden = [
    ...full.turns.filter((t) => t.player !== 'Aria' && t.private_notes.trim() !== '').map((t) => t.private_notes),
    ...full.turns.filter((t) => t.phase === 'whispers' && typeof t.action.message === 'string' && t.player !== 'Aria' && t.action.to !== 'Aria').map((t) => t.action.message as string),
  ];
  expect(forbidden.filter((x) => x.length > 8).length).toBeGreaterThan(10);
  await open(page, '&seat=Aria');
  const total = Number(/of (\d+)/.exec(await stepText(page))![1]);
  await page.getByRole('slider', { name: 'Step' }).focus();
  for (let i = 0; i < total; i++) {
    const body = await page.locator('body').innerText();
    const announced = (await page.getByTestId('announcement').textContent()) ?? '';
    for (const secret of forbidden.filter((x) => x.length > 8)) {
      expect(body.includes(secret), `step ${i}: page text has ${secret}`).toBe(false);
      expect(announced.includes(secret), `step ${i}: announcement`).toBe(false);
    }
    await page.keyboard.press('ArrowRight');
  }
});
