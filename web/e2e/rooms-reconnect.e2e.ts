import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { joinByInvite, makeRoom, playTurns } from './rooms-helpers.js';

// The room server in these tests gives a person 6 seconds per turn and closes an unattended game after 3 seconds.
test.setTimeout(180_000);

// Seed 2 gives a lone faithful host eleven turns, even if the first is missed. A random seed could murder them on the first night.
const LONE_HOST_SEED = '&seed=2';

test('reloading the lobby takes the seat back, and the others see the person offline and then back', async ({ page, browser }) => {
  const code = await makeRoom(page, 'Quinn');
  const friend = await (await browser.newContext()).newPage();
  await joinByInvite(friend, code, 'Rae');

  await friend.reload();
  await expect(friend.getByTestId('lobby')).toBeVisible();
  await expect(friend.getByTestId('seats').locator('li').nth(1)).toContainText('Rae (you)');
  await expect(friend.getByTestId('seats').locator('li')).toHaveCount(2); // the same seat, not a third
  await expect(page.getByTestId('seats').locator('li').nth(1)).not.toContainText('offline');
});

test('reloading in the middle of a game takes the seat back and the game goes on to the end', async ({ page, browser }) => {
  const code = await makeRoom(page, 'Quinn');
  const friend = await (await browser.newContext()).newPage();
  await joinByInvite(friend, code, 'Rae');
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(friend.getByTestId('room-game')).toBeVisible();

  await friend.reload();
  await expect(friend.getByTestId('room-game').or(friend.getByTestId('room-end'))).toBeVisible();
  await expect(friend.getByRole('heading', { name: 'Play with friends' })).toHaveCount(0); // not sent back to the start

  await Promise.all([playTurns(page, 'NOTE-FROM-QUINN'), playTurns(friend, 'NOTE-FROM-RAE')]);
  for (const p of [page, friend]) await expect(p.getByTestId('room-end')).toBeVisible();
});

test('a turn that runs out of time gets a fallback move, the person is told, and the game goes on', async ({ page }) => {
  await makeRoom(page, 'Quinn', LONE_HOST_SEED);
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('clock')).toBeVisible();

  // Do nothing: after the 6 seconds the turn closes and the page says a fallback was made. The next turn often follows
  // at once, so the note stays up (with that turn's form) until the person answers.
  await expect(page.getByTestId('timed-out')).toContainText('fallback move was made for you', { timeout: 30_000 });
  await expect(page.getByTestId('turn-form').or(page.getByTestId('waiting'))).toBeVisible();

  // Then play on, quickly; the game ends and the log shows the missed turn as a fallback.
  await playTurns(page, 'LATER-NOTE');
  await expect(page.getByTestId('room-end')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the game log' }).click()]);
  const log = JSON.parse(readFileSync((await download.path())!, 'utf8')) as { turns: { player: string; fallback: boolean }[] };
  const mine = log.turns.filter((t) => t.player === 'Quinn');
  expect(mine[0]?.fallback).toBe(true);
  expect(mine.some((t) => !t.fallback)).toBe(true);
});

test('when everyone walks away from a running game, the room closes and its code stops working', async ({ page, browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  const code = await makeRoom(host, 'Quinn', LONE_HOST_SEED);
  await host.getByRole('button', { name: 'Start the game' }).click();
  await expect(host.getByTestId('turn-form')).toBeVisible({ timeout: 30_000 });
  await context.close(); // the only person leaves

  // After the abandon time (3 seconds) the room is gone: a new person is told no room has that code.
  await expect(async () => {
    await page.goto(`/?mode=room&room=${code}`);
    await page.getByLabel('Your name at the table').fill('Rae');
    await page.getByRole('button', { name: 'Join room' }).click();
    await expect(page.getByRole('alert')).toContainText('No room has that code', { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
});
