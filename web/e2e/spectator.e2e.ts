import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-game.json';
// In the sample game Bram and Cleo are the traitors; everyone else is faithful.

async function open(page: Page, query: string): Promise<void> {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?log=sample${query}`);
}

async function walkTo(page: Page, title: string): Promise<void> {
  await page.getByRole('slider', { name: 'Step' }).focus();
  for (let i = 0; i < 90 && !(await page.getByTestId('section').innerText()).startsWith(title); i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('section')).toContainText(title);
}

test('?view=spectator opens the all-seeing room: every role over its seat, traitors marked', async ({ page }) => {
  await open(page, '&view=spectator');
  const room = page.getByTestId('room');
  await expect(room).toBeVisible();
  await expect(room.getByTestId('room-seat')).toHaveCount(8);
  await expect(room.getByTestId('room-role')).toHaveCount(8);
  await expect(room.locator('[data-mark=traitor]')).toHaveCount(2);
  await expect(room.locator('[data-mark=traitor]').first()).toHaveAttribute('data-name', /Bram|Cleo/);
  await expect(page.getByLabel('View', { exact: true })).toHaveValue('@all');
  await expect(room).toHaveAttribute('data-viewer', '');
});

test('the speaker’s private notes sit beside their speech, at a round table', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Round table');
  await expect(page.getByTestId('room-speech')).toBeVisible();
  await expect(page.getByTestId('room-thought')).toContainText('MOCKNOTE-');
});

test('a whisper is a line between two seats, with its text', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Whispers');
  // The whisper turns come after the first few silent ones; step until a line is drawn.
  for (let i = 0; i < 20 && (await page.getByTestId('room-whisper').count()) === 0; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('room-whisper')).toHaveCount(1);
  await expect(page.getByTestId('room-whisper')).toContainText('WHISPER-');
});

test('the director cuts to the speaker, holds on a traitor, and goes wide for votes', async ({ page }) => {
  await open(page, '&view=spectator');
  const room = page.getByTestId('room');
  await expect(room).toHaveAttribute('data-cut', 'true');
  await expect(room).toHaveAttribute('data-focus', 'Bram'); // the first night turn is Bram's
  await walkTo(page, 'Whispers');
  await expect(room).toHaveAttribute('data-wide', 'false');
  await walkTo(page, 'Banishment vote');
  await expect(room).toHaveAttribute('data-wide', 'true');
  await expect(room).toHaveAttribute('data-focus', '');
  // At a round table the camera holds on a traitor while someone they targeted or framed speaks.
  const holds: string[] = [];
  await page.getByRole('slider', { name: 'Step' }).focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 85; i++) {
    if ((await page.getByTestId('section').innerText()).startsWith('Round table')) {
      const speaker = ((await page.getByTestId('room-speech').locator('.room-who').textContent()) ?? '').trim();
      const focus = (await room.getAttribute('data-focus')) ?? '';
      if (focus !== speaker) holds.push(`${speaker}->${focus}`);
    }
    await page.keyboard.press('ArrowRight');
  }
  expect(holds.length).toBeGreaterThan(0);
  for (const h of holds) expect(['Bram', 'Cleo']).toContain(h.split('->')[1]);
});

test('click a seat to drop into that player’s view at the same moment; A returns to the all-seeing room', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Round table');
  const said = ((await page.getByTestId('room-speech').textContent()) ?? '').trim();
  // A real mouse click at the seat as drawn (locator.click scrolls first, and a 3D box moves under it while it does).
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await page.locator('[data-name=Aria] button').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', 'Aria');
  expect(((await page.getByTestId('room-speech').textContent()) ?? '').trim()).toBe(said);
  await expect(page.getByTestId('room-thought')).toHaveCount(0); // a player has no one else's notes
  await expect(page.getByTestId('room-whisper')).toHaveCount(0);
  await expect(page.locator('[data-mark=traitor]')).toHaveCount(0);
  expect(page.url()).toContain('seat=Aria');
  await page.keyboard.press('a');
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', '');
  await expect(page.getByTestId('room-thought')).toBeVisible();
  expect(((await page.getByTestId('room-speech').textContent()) ?? '').trim()).toContain(said.replace(/^\S+\s*/, '').slice(0, 20));
  expect(page.url()).toContain('view=spectator');
  expect(page.url()).not.toContain('seat=');
});

test('recording mode: the all-seeing room in 16:9 and 9:16', async ({ page }) => {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  for (const [aspect, wide] of [['16x9', true], ['9x16', false]] as const) {
    await page.goto(`/?mode=record&log=sample&view=spectator&aspect=${aspect}&speed=0.05&from=14&to=30`);
    const room = page.getByTestId('room');
    await expect(room).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(0); // a clip has no controls
    await expect(room.getByTestId('room-role')).toHaveCount(8);
    const box = (await page.getByTestId('stage').boundingBox())!;
    expect(box.width > box.height).toBe(wide);
  }
});

test('reduced motion: the light does not fade and a seat’s camera does not glide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '&view=spectator');
  await expect(page.locator('.room-light')).toHaveCSS('transition-duration', '0s'); // not already off because of a director's cut
  await open(page, '&seat=Aria');
  await expect(page.locator('.room-stage')).toHaveAttribute('style', /--turn/);
  await expect(page.locator('.room-stage')).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.room-seat').first()).toHaveCSS('transition-duration', '0s');
});

test('dropping into a traitor’s seat shows their fellow traitor and no traitor marks, notes or whispers', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Round table');
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = (await page.locator('[data-name=Bram] button').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', 'Bram');
  await expect(page.locator('[data-mark=traitor]')).toHaveCount(0);
  await expect(page.locator('[data-name=Cleo]')).toHaveAttribute('data-mark', 'fellow');
  await expect(page.getByTestId('room-thought')).toHaveCount(0);
  await expect(page.getByTestId('room-whisper')).toHaveCount(0);
  // Roles are shown only for seats that have left the table (the game revealed them), never for those still in it.
  await expect(page.locator('[data-status=alive] [data-testid=room-role]')).toHaveCount(0);
});

test('the status line in the all-seeing room reads out the notes and the whisper’s recipient', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Round table');
  await expect(page.getByTestId('announcement')).toContainText('Private notes: MOCKNOTE-');
  await page.keyboard.press('Home');
  for (let i = 0; i < 20 && (await page.getByTestId('room-whisper').count()) === 0; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('announcement')).toContainText(/Whisper from \w+ to \w+: .*WHISPER-/);
});

test('the plain public table is still the default, with no room', async ({ page }) => {
  await open(page, '');
  await expect(page.getByTestId('table')).toBeVisible();
  await expect(page.getByTestId('room')).toHaveCount(0);
});

test('every seat can be clicked, front or back of the room (a layer in front of a far seat used to take its clicks)', async ({ page }) => {
  await open(page, '&view=spectator');
  await walkTo(page, 'Round table');
  for (const name of ['Aria', 'Bram', 'Cleo', 'Dax', 'Esme', 'Finn', 'Gwen', 'Hugo']) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = (await page.locator(`[data-name=${name}] button`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('room'), name).toHaveAttribute('data-viewer', name);
    await page.keyboard.press('a');
    await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', '');
  }
});
