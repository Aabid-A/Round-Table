import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { holdTurns, joinByInvite, makeRoom, playTurns } from './rooms-helpers.js';

test.setTimeout(180_000);

// Seed 5 with two people: Quinn (a traitor) speaks at the first round table and Rae has eleven turns after it. With a random
// seed, a person murdered on the first night has no turns, and a test that needs their notes in the log fails about 1 time in 8.
const TWO_PEOPLE_SEED = '&seed=5';

/** Errors the page reports to its console, or throws. A healthy page reports none (the dev server has no favicon, so that 404 is ignored). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/favicon.ico') && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('two people play a whole game together, and both see the same end screen', async ({ page, browser }) => {
  const errors = watchErrors(page);
  const code = await makeRoom(page, 'Quinn', TWO_PEOPLE_SEED);
  const friend = await (await browser.newContext()).newPage();
  const friendErrors = watchErrors(friend);
  await joinByInvite(friend, code, 'Rae');
  await expect(page.getByTestId('seats').locator('li')).toHaveCount(2);

  await page.getByRole('button', { name: 'Start the game' }).click();
  // Both leave the lobby; each sees the clock on their own turn and a status line otherwise.
  for (const p of [page, friend]) await expect(p.getByTestId('room-game')).toBeVisible();

  const [quinnTurns, raeTurns] = await Promise.all([
    playTurns(page, 'NOTE-FROM-QUINN', ['NOTE-FROM-RAE', 'MOCKNOTE']),
    playTurns(friend, 'NOTE-FROM-RAE', ['NOTE-FROM-QUINN', 'MOCKNOTE']),
  ]);
  expect(quinnTurns + raeTurns).toBeGreaterThan(0);
  expect(errors, 'console errors on the host page').toEqual([]);
  expect(friendErrors, 'console errors on the friend page').toEqual([]);

  for (const p of [page, friend]) await expect(p.getByTestId('room-end')).toBeVisible();
  const heading = await page.getByRole('heading', { level: 1 }).innerText();
  expect(heading).toMatch(/win|stopped/);
  await expect(friend.getByRole('heading', { level: 1 })).toHaveText(heading);

  // Everyone is revealed: eight seats, two of them people.
  for (const p of [page, friend]) {
    const reveal = p.getByTestId('reveal').locator('li');
    await expect(reveal).toHaveCount(8);
    await expect(reveal.filter({ hasText: 'A person' })).toHaveCount(2);
    await expect(reveal.filter({ hasText: 'A practice AI' })).toHaveCount(6);
    await expect(reveal.filter({ hasText: /Traitor/ })).not.toHaveCount(0);
  }
  await expect(page.getByTestId('reveal')).toContainText('Quinn (you)');
  await expect(friend.getByTestId('reveal')).toContainText('Rae (you)');

  // The log is a normal log: eight cast members, two of them people, with both people's notes in it.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the game log' }).click()]);
  const log = JSON.parse(readFileSync((await download.path())!, 'utf8')) as { schemaVersion: number; cast: { name: string; model: string }[]; turns: { private_notes: string }[] };
  expect(log.schemaVersion).toBe(1);
  expect(log.cast.filter((c) => c.model === 'human').map((c) => c.name).sort()).toEqual(['Quinn', 'Rae']);
  const notes = log.turns.map((t) => t.private_notes).join('\n');
  expect(notes).toContain('NOTE-FROM-QUINN');
  expect(notes).toContain('NOTE-FROM-RAE');
});

// Seed 2 gives a lone faithful host eleven turns. A random seed could murder them on the first night, with no turn to wait for.
const LONE_HOST_SEED = '&seed=2';

test("what one person types is shown to the other as plain text, never as markup", async ({ page, browser }) => {
  const markup = '<img src=x onerror="window.__xss=1"><b>bold</b>';
  const code = await makeRoom(page, 'Quinn', TWO_PEOPLE_SEED);
  const friend = await (await browser.newContext()).newPage();
  await joinByInvite(friend, code, 'Rae');
  await page.getByRole('button', { name: 'Start the game' }).click();

  const seenByRae: string[] = [];
  await Promise.all([playTurns(page, 'q', [], { speech: markup }), playTurns(friend, 'r', [], { seen: seenByRae })]);

  // Rae was told what Quinn said, character for character.
  expect(seenByRae.join('\n')).toContain('<img src=x onerror="window.__xss=1"><b>bold</b>');
  for (const p of [page, friend]) {
    expect(await p.evaluate(() => (window as unknown as { __xss?: number }).__xss), 'no script ran').toBeUndefined();
    await expect(p.locator('img[src="x"]')).toHaveCount(0);
    await expect(p.locator('b', { hasText: 'bold' })).toHaveCount(0);
  }
  // It is in the log as text too.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the game log' }).click()]);
  expect(readFileSync((await download.path())!, 'utf8')).toContain('onerror=\\"window.__xss=1\\"');
});

test('a host alone with practice AIs can start at once and play through', async ({ page }) => {
  await makeRoom(page, 'Quinn', LONE_HOST_SEED);
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.getByTestId('room-game')).toBeVisible();
  await playTurns(page, 'MY-NOTE', ['MOCKNOTE']);
  await expect(page.getByTestId('room-end')).toBeVisible();
  await expect(page.getByTestId('reveal').locator('li').filter({ hasText: 'A person' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to the start' }).click();
  await expect(page.getByRole('heading', { name: 'Play with friends' })).toBeVisible();
});

test('on your turn there is a clock and the form; between turns the status says nothing about who is acting', async ({ page }) => {
  await holdTurns(page);
  await makeRoom(page, 'Quinn', LONE_HOST_SEED);
  await page.getByRole('button', { name: 'Start the game' }).click();
  const form = page.getByTestId('turn-form');
  const waiting = page.getByTestId('waiting');
  await expect(form.or(waiting)).toBeVisible({ timeout: 30_000 });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('clock')).toContainText('Time left');
  await expect(page.getByTestId('clock')).toContainText('fallback move');
  // Answer once and look at the waiting line that follows. The next turn is held back for two seconds, because with instant
  // practice AIs it could otherwise arrive before the test looks, and the line is only there until it does.
  await page.evaluate(() => ((window as unknown as { __hold: number }).__hold = 2000));
  await playTurnOnce(page);
  await expect(waiting).toBeVisible({ timeout: 30_000 });
  const line = await waiting.innerText();
  expect(line).toContain('Waiting for the others');
  for (const name of ['Aria', 'Bram', 'Cleo', 'Dax', 'Esme', 'Finn', 'Gwen', 'Hugo']) expect(line).not.toContain(name);
});

async function playTurnOnce(page: Page): Promise<void> {
  const form = page.getByTestId('turn-form');
  const phase = await form.getAttribute('data-phase');
  if (phase === 'whispers') await form.getByLabel('Send no whisper').check();
  else if (phase === 'recruit_choose') await form.getByLabel('Make no offer').check();
  else await form.locator('input[type=radio]').first().check();
  if (phase === 'round_table') {
    await form.locator('textarea').fill('I speak.');
    await form.getByLabel(/Why you suspect them/).fill('because');
  }
  await form.getByRole('button', { name: 'Send' }).click();
}
