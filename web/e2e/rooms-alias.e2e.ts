import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { joinByInvite, makeRoom, playTurns } from './rooms-helpers.js';

test.setTimeout(180_000);

// With aliases the seats are shuffled by the seed. This seed gave both people turns in the whole-game test (the plain room uses the
// same seed); a random one could murder someone on the first night, which would not matter here, but keeps the run repeatable.
const SEED = '&seed=5';
const ALIASES = ['Aria', 'Bram', 'Cleo', 'Dax', 'Esme', 'Finn', 'Gwen', 'Hugo'];
const ROOM_LOGS = join('test-results', 'room-logs'); // where the e2e room server saves logs (see playwright.config.ts)

/** The PNG's width and height from its header. */
const pngSize = (file: Buffer): { width: number; height: number } => ({ width: file.readUInt32BE(16), height: file.readUInt32BE(20) });

async function startAliasGame(page: Page, friend: Page): Promise<string> {
  const code = await makeRoom(page, 'Quinn', SEED, { aliases: true });
  await joinByInvite(friend, code, 'Rae');
  for (const p of [page, friend]) await expect(p.getByTestId('alias-note')).toContainText('Everyone plays under an alias');
  await page.getByRole('button', { name: 'Start the game' }).click();
  return code;
}

test('everyone plays under an alias, and neither real name shows on either page during the game', async ({ page, browser }) => {
  const friend = await (await browser.newContext()).newPage();
  await startAliasGame(page, friend);
  for (const p of [page, friend]) await expect(p.getByTestId('room-game')).toBeVisible();

  const headerOf = async (p: Page): Promise<string> => {
    const text = await p.locator('.topbar .muted').innerText();
    return text.replace('You are ', '');
  };
  const [mine, theirs] = [await headerOf(page), await headerOf(friend)];
  expect(ALIASES).toContain(mine);
  expect(ALIASES).toContain(theirs);
  expect(mine).not.toBe(theirs);

  // Playing through, neither page ever shows a real name (not in the header, the prompts, or what the other person said).
  await Promise.all([playTurns(page, 'q-note', ['Quinn', 'Rae']), playTurns(friend, 'r-note', ['Quinn', 'Rae'])]);
  for (const p of [page, friend]) await expect(p.getByTestId('guess')).toBeVisible();
});

test('the guess screen lists the other seven seats, says what no ticks means, and tells nothing about who was who', async ({ page, browser }) => {
  const friend = await (await browser.newContext()).newPage();
  await startAliasGame(page, friend);
  await Promise.all([playTurns(page, 'q', ['Quinn', 'Rae']), playTurns(friend, 'r', ['Quinn', 'Rae'])]);
  await expect(page.getByTestId('guess')).toBeVisible();

  const me = (await page.locator('.topbar .muted').innerText()).replace('You were ', '');
  const boxes = page.getByRole('checkbox');
  await expect(boxes).toHaveCount(7);
  await expect(page.getByRole('checkbox', { name: me })).toHaveCount(0); // not your own seat
  await expect(page.getByTestId('guess-count')).toContainText('No seats ticked');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.getByTestId('guess-count')).toHaveText('2 of 7 seats ticked as AIs.');
  await expect(page.getByTestId('clock')).toContainText('your guess is not counted');

  // Nothing here says who was a person, an AI, a traitor or a faithful: that is for after the guess.
  const body = await page.locator('body').innerText();
  for (const spoiler of ['Traitor', 'Faithful', 'practice AI', 'A person', 'Quinn', 'Rae', 'wins']) expect(body, spoiler).not.toContain(spoiler);
  await expect(page.getByTestId('room-end')).toHaveCount(0);

  await page.getByRole('button', { name: 'Send my guess' }).click();
  await expect(page.getByTestId('guess-sent')).toContainText('Waiting for the others');
  await expect(page.getByTestId('room-end')).toHaveCount(0); // the friend has not guessed yet
});

test('after both guess: who was who with real names, the scores, who fooled whom, a result card, a share text and a saved log', async ({ page, browser }) => {
  const friend = await (await browser.newContext()).newPage();
  await startAliasGame(page, friend);
  await Promise.all([playTurns(page, 'q', ['Quinn', 'Rae']), playTurns(friend, 'r', ['Quinn', 'Rae'])]);

  // Quinn calls nobody an AI; Rae calls every other seat one.
  await page.getByRole('button', { name: 'Send my guess' }).click();
  for (const box of await friend.getByRole('checkbox').all()) await box.check();
  await friend.getByRole('button', { name: 'Send my guess' }).click();
  for (const p of [page, friend]) await expect(p.getByTestId('room-end')).toBeVisible();

  // The reveal now names the people behind the aliases: two people, six AIs.
  const reveal = page.getByTestId('reveal').locator('li');
  await expect(reveal).toHaveCount(8);
  await expect(reveal.filter({ hasText: 'Quinn, a person' })).toHaveCount(1);
  await expect(reveal.filter({ hasText: 'Rae, a person' })).toHaveCount(1);
  await expect(reveal.filter({ hasText: 'A practice AI' })).toHaveCount(6);
  await expect(page.getByTestId('reveal')).toContainText('(you)');

  // Quinn called no one an AI: right only about the other person. Rae called all seven AIs: right about the six AIs.
  await expect(page.getByTestId('my-score')).toHaveText('You got 1 of 7 right.');
  await expect(friend.getByTestId('my-score')).toHaveText('You got 6 of 7 right.');
  await expect(page.getByTestId('scores')).toContainText('Quinn got 1 of 7 right.');
  await expect(page.getByTestId('scores')).toContainText('Rae got 6 of 7 right.');
  const fooling = page.getByTestId('fooling').locator('li');
  await expect(fooling).toHaveCount(8);
  expect(await fooling.first().innerText()).toMatch(/ fooled .*\.$/);

  // The share text has the replay link and gives nothing away.
  const share = await page.getByTestId('share-text').inputValue();
  const link = /\?log=(room-[A-Z0-9]{5}-seed-\d+)/.exec(share);
  expect(link, share).not.toBeNull();
  expect(share).toContain('1 of 7 right');
  for (const spoiler of ['win', 'trait', 'faithful', 'trusted', 'fooled']) expect(share.toLowerCase(), spoiler).not.toContain(spoiler);

  // The result card is a 1200x675 PNG.
  const [card] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the result card' }).click()]);
  expect(card.suggestedFilename()).toMatch(/^round-table-room-[A-Z0-9]{5}-result\.png$/);
  expect(pngSize(readFileSync((await card.path())!))).toEqual({ width: 1200, height: 675 });

  // The room saved a normal log, under the name the replay link uses: eight seats under the AI names, two of them people.
  const saved = JSON.parse(readFileSync(join(ROOM_LOGS, `${link![1]}.json`), 'utf8')) as { schemaVersion: number; cast: { name: string; model: string }[] };
  expect(saved.schemaVersion).toBe(1);
  expect(saved.cast.map((c) => c.name)).toEqual(ALIASES);
  expect(saved.cast.filter((c) => c.model === 'human')).toHaveLength(2);
  expect(JSON.stringify(saved)).not.toMatch(/Quinn|Rae/); // real names are not in the log either, only aliases
});

test('a person who leaves while the others guess is not waited for, and is not scored', async ({ page, browser }) => {
  const context = await browser.newContext();
  const friend = await context.newPage();
  await startAliasGame(page, friend);
  await Promise.all([playTurns(page, 'q', ['Quinn', 'Rae']), playTurns(friend, 'r', ['Quinn', 'Rae'])]);
  await expect(friend.getByTestId('guess')).toBeVisible();
  await context.close(); // Rae goes away without guessing

  await page.getByRole('button', { name: 'Send my guess' }).click();
  await expect(page.getByTestId('room-end')).toBeVisible({ timeout: 20_000 }); // far sooner than the 60 second limit
  await expect(page.getByTestId('scores').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('scores')).toContainText('Quinn got');
});

test('reloading while guessing brings the guess screen back, with the same alias', async ({ page, browser }) => {
  const friend = await (await browser.newContext()).newPage();
  await startAliasGame(page, friend);
  await Promise.all([playTurns(page, 'q', ['Quinn', 'Rae']), playTurns(friend, 'r', ['Quinn', 'Rae'])]);
  const me = (await page.locator('.topbar .muted').innerText()).replace('You were ', '');

  await page.reload();
  await expect(page.getByTestId('guess')).toBeVisible();
  await expect(page.locator('.topbar .muted')).toHaveText(`You were ${me}`);
  await expect(page.getByRole('checkbox')).toHaveCount(7);
});
