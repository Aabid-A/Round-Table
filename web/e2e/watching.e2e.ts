import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { joinByInvite, playTurns } from './rooms-helpers.js';

test.setTimeout(120_000);

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as {
  cast: { name: string }[];
  turns: { player: string; attempts: { prompt: string }[] }[];
};
const TOKEN = /^[0-9a-f-]{36}$/;

/** Open the create form and make a room, ticking the options asked for. */
async function makeRoomWith(page: Page, name: string, opts: { ghosts?: boolean; spectators?: boolean }, query = ''): Promise<string> {
  await page.goto(`/?mode=room${query}`);
  const create = page.getByRole('region', { name: 'Make a room' });
  await create.getByLabel('Your name at the table').fill(name);
  if (opts.ghosts) await create.getByTestId('ghosts-option').check();
  if (opts.spectators) await create.getByTestId('spectators-option').check();
  await create.getByRole('button', { name: 'Make room' }).click();
  await expect(page.getByTestId('lobby')).toBeVisible();
  return (await page.getByTestId('room-code').innerText()).trim();
}

test('the create form offers ghosts and a watch link, off by default, with a warning beside each', async ({ page }) => {
  await page.goto('/?mode=room');
  const create = page.getByRole('region', { name: 'Make a room' });
  await expect(create.getByTestId('ghosts-option')).not.toBeChecked();
  await expect(create.getByTestId('spectators-option')).not.toBeChecked();
  await expect(create.getByTestId('ghosts-note')).toContainText('hidden information');
  await expect(create.getByTestId('spectators-note')).toContainText('every role, note and whisper');
});

test('the host gets the watch link and a friend does not, and each is told when ghosts are on', async ({ page, browser }) => {
  const code = await makeRoomWith(page, 'Quinn', { ghosts: true, spectators: true });
  await expect(page.getByTestId('ghosts-note')).toContainText('Ghosts are on');
  const link = await page.getByTestId('watch-link').inputValue();
  expect(link).toMatch(/\?mode=watch&room=[A-Z0-9]{5}&k=[0-9a-f-]{36}$/);
  expect(link).toContain(code);

  const friend = await (await browser.newContext()).newPage();
  await joinByInvite(friend, code, 'Rae');
  await expect(friend.getByTestId('ghosts-note')).toContainText('Ghosts are on');
  await expect(friend.getByTestId('spectators-note')).toBeVisible();
  await expect(friend.getByTestId('watch-link')).toHaveCount(0);
  expect(await friend.locator('body').innerHTML()).not.toContain(link.split('k=')[1]!);
});

test('a room made without the options has no watch link and no notes', async ({ page }) => {
  await makeRoomWith(page, 'Quinn', {});
  await expect(page.getByTestId('watch-field')).toHaveCount(0);
  await expect(page.getByTestId('ghosts-note')).toHaveCount(0);
});

test('the watch link shows the lobby, then the game, and the whole game when it is over', async ({ page, browser }) => {
  await makeRoomWith(page, 'Quinn', { spectators: true }, '&seed=5');
  const link = await page.getByTestId('watch-link').inputValue();
  const watcher = await (await browser.newContext()).newPage();
  await watcher.goto(link);
  await expect(watcher.getByTestId('watch-lobby')).toContainText('has not started');

  await page.getByRole('button', { name: 'Start the game' }).click();
  await playTurns(page, 'NOTE-FROM-QUINN');
  await expect(page.getByTestId('room-end')).toBeVisible();

  await expect(watcher.getByTestId('watch-note')).toContainText('The game is over', { timeout: 15_000 });
  // The all-seeing room, with every role over its seat.
  await expect(watcher.getByTestId('room')).toBeVisible();
  await expect(watcher.getByTestId('room').getByTestId('room-role')).toHaveCount(8);
  await expect(watcher.getByRole('button', { name: 'Load another log' })).toHaveCount(0);
  // And it can be walked to the result.
  await watcher.getByRole('slider', { name: 'Step' }).focus();
  await watcher.keyboard.press('End');
  await expect(watcher.getByTestId('section')).toHaveText(/Result/);
});

test('a watch link that is wrong, or made up, says so and shows nothing', async ({ page }) => {
  await page.goto('/?mode=watch&room=AB2CD&k=3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f');
  await expect(page.getByTestId('watch-refused')).toContainText('That watch link does not work.');
  await page.goto('/?mode=watch&room=AB2CD&k=nope');
  await expect(page.getByTestId('watch-refused')).toContainText('does not look right');
  await page.goto('/?mode=watch');
  await expect(page.getByTestId('watch-refused')).toBeVisible();
  expect(TOKEN.test('3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f')).toBe(true);
});

test('a ghost sees every seat, hidden information included, and can move between them (scripted server)', async ({ page }) => {
  // A seat that was out before its first turn has not been told anything: no prompt.
  const promptOf = (name: string): string | null => sample.turns.find((t) => t.player === name)?.attempts[0]?.prompt ?? null;
  const seats = sample.cast.map((c) => ({ name: c.name, status: c.name === 'Aria' ? ('murdered' as const) : ('alive' as const), prompt: promptOf(c.name) }));
  await page.routeWebSocket(/:8788/, (ws) => {
    ws.onMessage((raw) => {
      const m = JSON.parse(String(raw)) as { t: string };
      if (m.t === 'create') {
        ws.send(JSON.stringify({ t: 'joined', code: 'AB2CD', token: '3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f', you: 'Aria', host: true }));
        ws.send(JSON.stringify({ t: 'lobby', code: 'AB2CD', mode: 'mock', aliases: false, ghosts: true, spectators: false, seats: [{ name: 'Aria', connected: true, host: true }], aiSeats: 7, maxHumans: 8 }));
      } else if (m.t === 'start') {
        ws.send(JSON.stringify({ t: 'status', phase: 'night' }));
        ws.send(JSON.stringify({ t: 'ghost', you: 'Aria', seats }));
      }
    });
  });
  await page.goto('/?mode=room');
  const create = page.getByRole('region', { name: 'Make a room' });
  await create.getByLabel('Your name at the table').fill('Aria2');
  await create.getByTestId('ghosts-option').check();
  await create.getByRole('button', { name: 'Make room' }).click();
  await page.getByRole('button', { name: 'Start the game' }).click();

  const ghost = page.getByTestId('ghost');
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText('hidden information');
  await expect(ghost.getByTestId('ghost-seat')).toHaveCount(8);
  await expect(page.getByTestId('turn-form')).toHaveCount(0); // a ghost has no turn to take
  // Choose a traitor's seat: the room is that seat's, with its role and its fellow traitor.
  await ghost.getByTestId('ghost-seat').filter({ hasText: 'Bram' }).click();
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', 'Bram');
  await expect(page.locator('[data-mark=fellow]')).toHaveCount(1);
  // And a faithful's seat shows no fellow.
  await ghost.getByTestId('ghost-seat').filter({ hasText: 'Dax' }).click();
  await expect(page.getByTestId('room')).toHaveAttribute('data-viewer', 'Dax');
  await expect(page.locator('[data-mark=fellow]')).toHaveCount(0);
});
