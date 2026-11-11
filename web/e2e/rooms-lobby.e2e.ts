import { expect, test } from '@playwright/test';
import { joinByInvite, makeRoom } from './rooms-helpers.js';

test('a host makes a room and sees the code, an invite link and their own seat', async ({ page }) => {
  const code = await makeRoom(page, 'Quinn');
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  await expect(page.getByTestId('invite-link')).toHaveValue(new RegExp(`\\?mode=room&room=${code}$`));
  const seats = page.getByTestId('seats').locator('li');
  await expect(seats).toHaveCount(1);
  await expect(seats.first()).toContainText('Quinn (you)');
  await expect(seats.first()).toContainText('host');
  await expect(page.getByTestId('ai-seats')).toHaveText('7 AI seats will be filled by practice AIs.');
  await expect(page.getByRole('button', { name: 'Start the game' })).toBeEnabled();
});

test('a friend joins from the invite link, and both lobbies list both people', async ({ page, browser }) => {
  const code = await makeRoom(page, 'Quinn');
  const friendPage = await (await browser.newContext()).newPage();
  await joinByInvite(friendPage, code, 'Rae');

  for (const p of [page, friendPage]) {
    await expect(p.getByTestId('seats').locator('li')).toHaveCount(2);
    await expect(p.getByTestId('ai-seats')).toHaveText('6 AI seats will be filled by practice AIs.');
  }
  await expect(friendPage.getByTestId('seats').locator('li').nth(1)).toContainText('Rae (you)');
  await expect(friendPage.getByTestId('waiting-for-host')).toHaveText('Waiting for Quinn to start the game.');
  await expect(friendPage.getByRole('button', { name: 'Start the game' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start the game' })).toBeEnabled();
});

test('an invite link opens on the join form with the code filled in, and has no code to type', async ({ page }) => {
  await page.goto('/?mode=room&room=ab2cd');
  await expect(page.getByRole('heading', { name: 'Join room AB2CD' })).toBeVisible();
  await expect(page.getByLabel('Room code')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Make a room' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Make my own room instead' }).click();
  await expect(page.getByRole('region', { name: 'Make a room' })).toBeVisible();
});

test('the forms say what is wrong, and the server refuses an unknown code and a taken name', async ({ page, browser }) => {
  await page.goto('/?mode=room');
  const join = page.getByRole('region', { name: 'Join a room' });
  const create = page.getByRole('region', { name: 'Make a room' });
  const alert = page.getByRole('alert');

  await join.getByRole('button', { name: 'Join room' }).click();
  await expect(alert).toContainText('Enter the 5-letter room code');
  await join.getByLabel('Room code').fill('ZZZZZ');
  await join.getByLabel('Your name at the table').fill('Rae');
  await join.getByRole('button', { name: 'Join room' }).click();
  await expect(alert).toContainText('No room has that code');
  // Editing a field clears the message.
  await join.getByLabel('Room code').fill('ZZZZ');
  await expect(alert).toHaveCount(0);

  await create.getByLabel('Your name at the table').fill('Aria');
  await create.getByRole('button', { name: 'Make room' }).click();
  await expect(alert).toContainText("Aria is already an AI's name");

  const code = await makeRoom(page, 'Quinn');
  const other = await (await browser.newContext()).newPage();
  await other.goto(`/?mode=room&room=${code}`);
  await other.getByLabel('Your name at the table').fill('QUINN');
  await other.getByRole('button', { name: 'Join room' }).click();
  await expect(other.getByRole('alert')).toContainText('QUINN is taken at this table');
  await expect(other.getByTestId('lobby')).toHaveCount(0);
});

test('real models need a key, model IDs and a cap before anything is sent; the key field is private', async ({ page }) => {
  await page.goto('/?mode=room');
  const create = page.getByRole('region', { name: 'Make a room' });
  await create.getByLabel('Your name at the table').fill('Quinn');
  await create.getByLabel(/Real models through OpenRouter/).check();
  const key = create.getByLabel('Your OpenRouter key');
  await expect(key).toHaveAttribute('type', 'password');
  await expect(key).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.getByTestId('key-note')).toContainText('held in memory for this room only');
  await create.getByRole('button', { name: 'Make room' }).click();
  await expect(page.getByRole('alert')).toContainText('Paste your OpenRouter key');
  await key.fill('not-a-real-key');
  await create.getByRole('button', { name: 'Make room' }).click();
  await expect(page.getByRole('alert')).toContainText('model IDs');
  await create.getByLabel(/Model IDs/).fill('vendor/one');
  await create.getByLabel(/Spend cap/).fill('99');
  await create.getByRole('button', { name: 'Make room' }).click();
  await expect(page.getByRole('alert')).toContainText('spend cap must be above 0 and at most $25');
  await expect(page.getByTestId('lobby')).toHaveCount(0); // none of these reached a room
});

test('the host sees a friend go offline, and leaving returns to the start', async ({ page, browser }) => {
  const code = await makeRoom(page, 'Quinn');
  const context = await browser.newContext();
  const friend = await context.newPage();
  await joinByInvite(friend, code, 'Rae');
  await expect(page.getByTestId('seats').locator('li').nth(1)).not.toContainText('offline');
  await context.close();
  await expect(page.getByTestId('seats').locator('li').nth(1)).toContainText('offline');

  await page.getByRole('button', { name: 'Leave room' }).click();
  await expect(page.getByRole('heading', { name: 'Play with friends' })).toBeVisible();
});
