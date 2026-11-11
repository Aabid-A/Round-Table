import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-game.json';
const log = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { roles: Record<string, string>; cast: { name: string }[]; settings: { traitors: number } };
const traitors = Object.keys(log.roles).filter((n) => log.roles[n] === 'traitor');
const entry = (number: number, name: string) => ({ number, name, players: 8, traitors: 2, rounds: 3 });
const INDEX = { indexVersion: 1, episodes: [entry(1, 'sample'), entry(2, 'second')] };

async function routes(page: Page, withIndex = true): Promise<void> {
  await page.route('**/games/sample.json', (r) => r.fulfill({ path: FIXTURE }));
  await page.route('**/games/second.json', (r) => r.fulfill({ path: FIXTURE }));
  await page.route('**/games/index.json', (r) =>
    withIndex ? r.fulfill({ body: JSON.stringify(INDEX), contentType: 'application/json' }) : r.fulfill({ status: 404, body: '' }),
  );
}

const next = (page: Page) => page.getByRole('button', { name: 'Next' });
async function toPick(page: Page): Promise<void> {
  for (let i = 0; i < 200 && !(await page.getByTestId('pick-form').count()); i++) await next(page).click();
  await expect(page.getByTestId('pick-form')).toBeVisible();
}
async function lock(page: Page, prefer: (name: string) => boolean): Promise<string[]> {
  const labels = await page.locator('.pick-option').allInnerTexts();
  const need = Number(/Pick (\d+)\./.exec(await page.locator('legend').innerText())![1]);
  const chosen = [...labels.filter(prefer), ...labels.filter((n) => !prefer(n))].slice(0, need);
  for (const name of chosen) await page.getByLabel(name, { exact: true }).check();
  await page.getByRole('button', { name: 'Lock my picks' }).click();
  await expect(page.getByTestId('pick-locked')).toBeVisible();
  return chosen;
}
async function toScore(page: Page, prefer: (name: string) => boolean): Promise<void> {
  for (let guard = 0; guard < 10; guard++) {
    if (await page.getByTestId('score').count()) return;
    await toPickOrScore(page);
    if (await page.getByTestId('score').count()) return;
    await lock(page, prefer);
  }
}
async function toPickOrScore(page: Page): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if ((await page.getByTestId('pick-form').count()) || (await page.getByTestId('score').count())) return;
    await next(page).click();
  }
}

test('plays public steps only, stops at a pick, and will not go on until the picks are locked', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample&episode=1');
  await expect(page.getByRole('heading', { level: 1, name: 'Guess the traitor' })).toBeVisible();
  await expect(page.getByText('Episode 1')).toBeVisible();
  await toPick(page);
  await expect(page.getByTestId('section')).toContainText('Your picks');
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
  await expect(page.getByText('Lock your picks to carry on.')).toBeVisible();
  // Nothing private so far: no notes, no night, no whispers.
  const body = await page.locator('body').innerText();
  for (const secret of ['MOCKNOTE', 'Proposes murdering', 'whispers', 'Hidden from players']) expect(body, secret).not.toContain(secret);
  await lock(page, (n) => traitors.includes(n));
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  await expect(page.getByTestId('section')).toContainText('Banishment vote');
});

test('after locking, keyboard focus moves to the locked message instead of being lost', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample');
  await toPick(page);
  const boxes = page.locator('.pick-option input');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: 'Lock my picks' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pick-locked')).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'your picks are locked' })).toBeVisible();
});

test('picking: the right number, no more, and the lock button waits', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample');
  await toPick(page);
  const lockButton = page.getByRole('button', { name: 'Lock my picks' });
  await expect(lockButton).toBeDisabled();
  const boxes = page.locator('.pick-option input');
  await boxes.nth(0).check();
  await expect(lockButton).toBeDisabled();
  await boxes.nth(1).check();
  await expect(lockButton).toBeEnabled();
  await expect(boxes.nth(2)).toBeDisabled(); // already two picked
  await boxes.nth(1).uncheck();
  await expect(boxes.nth(2)).toBeEnabled();
  await expect(lockButton).toBeDisabled();
});

test('arrow keys do not move the episode while you are in the picking form', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample');
  await toPick(page);
  await page.locator('.pick-option input').first().focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('pick-form')).toBeVisible();
  await expect(page.getByTestId('section')).toContainText('Your picks');
});

test('you can go back to earlier steps but a locked pick stays locked', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample');
  await toPick(page);
  await lock(page, (n) => traitors.includes(n));
  await next(page).click();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByTestId('pick-locked')).toBeVisible();
  await expect(page.getByTestId('pick-form')).toHaveCount(0);
});

test('all the right picks give an all-green score, the reveal and no missed section', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample&episode=1');
  await toScore(page, (n) => traitors.includes(n));
  const heading = await page.getByRole('heading', { level: 2, name: /You found/ }).innerText();
  const [, got, of] = /found (\d+) of (\d+)/.exec(heading)!;
  expect(got).toBe(of);
  const row = await page.getByTestId('emoji-row').innerText();
  expect(row).toMatch(/^🟩+$/u);
  await expect(page.getByTestId('missed')).toHaveCount(0);
  const reveal = await page.getByTestId('reveal').innerText();
  for (const t of traitors) expect(reveal).toContain(`${t} · Traitor`);
});

test('wrong picks show the missed traitors with what they said and privately thought', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample&episode=1');
  await toScore(page, (n) => !traitors.includes(n));
  const row = await page.getByTestId('emoji-row').innerText();
  expect(row).toContain('⬛');
  const missed = page.getByTestId('missed');
  await expect(missed).toBeVisible();
  await expect(missed).toContainText('Thought, hidden from the players');
  await expect(missed).toContainText('MOCKNOTE');
  await expect(page.getByRole('list', { name: 'Round by round' })).toContainText('none found');
});

test('the share text has the episode number, the row and the link, and names no one', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample&episode=1');
  await toScore(page, (n) => traitors.includes(n));
  const text = await page.getByTestId('share-text').innerText();
  expect(text).toMatch(/^Round Table #1 🟩+ \d+\/\d+\nhttp:\/\/localhost:5183\/\?mode=guess&log=sample&episode=1$/u);
  for (const name of log.cast.map((c) => c.name)) expect(text, name).not.toContain(name);
  for (const word of ['traitor', 'faithful', 'Traitor', 'Faithful']) expect(text, word).not.toContain(word);
});

test('copy puts the share text on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await routes(page);
  await page.goto('/?mode=guess&log=sample&episode=1');
  await toScore(page, (n) => traitors.includes(n));
  await page.getByRole('button', { name: 'Copy result' }).click();
  await expect(page.getByTestId('share-note')).toHaveText('Copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.getByTestId('share-text').innerText());
});

test('download card saves a 1200x675 PNG', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample&episode=1');
  await toScore(page, (n) => traitors.includes(n));
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download card' }).click()]);
  expect(download.suggestedFilename()).toBe('round-table-1-result.png');
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 675]);
});

test('watch again starts over with fresh picks', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess&log=sample');
  await toScore(page, (n) => traitors.includes(n));
  await page.getByRole('button', { name: 'Watch again' }).click();
  await expect(page.getByTestId('score')).toHaveCount(0);
  await toPick(page);
  await expect(page.getByTestId('pick-form')).toBeVisible();
});

test('the episodes page lists the episodes and links to today and each one', async ({ page }) => {
  await routes(page);
  await page.goto('/?page=episodes');
  const items = page.getByRole('list', { name: 'Episodes' }).getByRole('link');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toHaveAttribute('href', '?mode=guess&log=sample&episode=1');
  await expect(page.getByRole('link', { name: /Play today/ })).toHaveAttribute('href', '?mode=guess&episode=today');
  await items.nth(1).click();
  await expect(page.getByText('Episode 2')).toBeVisible();
});

test('?mode=guess with no episode shows the list', async ({ page }) => {
  await routes(page);
  await page.goto('/?mode=guess');
  await expect(page.getByRole('list', { name: 'Episodes' })).toBeVisible();
});

test("today's episode is the same for the same date and moves on the next day", async ({ page }) => {
  await routes(page);
  const labelFor = async (date: string): Promise<string> => {
    await page.goto(`/?mode=guess&episode=today&date=${date}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Guess the traitor' })).toBeVisible();
    return page.locator('.topbar .muted').innerText();
  };
  const a1 = await labelFor('2026-11-11');
  const a2 = await labelFor('2026-11-11');
  const b = await labelFor('2026-11-12');
  expect(a1).toBe(a2);
  expect(b).not.toBe(a1);
  const day = Math.floor(Date.UTC(2026, 10, 11) / 86_400_000);
  expect(a1).toBe(`Episode ${(day % 2) + 1}`);
});

test('says what to do when the episode list is missing or the episode number is unknown', async ({ page }) => {
  await routes(page, false);
  await page.goto('/?mode=guess&episode=today');
  await expect(page.getByRole('alert')).toContainText('No episode list yet. Create it with npm run episodes');
  await page.goto('/?page=episodes');
  await expect(page.getByRole('alert')).toContainText('No episode list yet');
  await routes(page);
  await page.goto('/?mode=guess&episode=9');
  await expect(page.getByRole('alert')).toContainText('There is no episode 9.');
  await page.goto('/?mode=guess&log=nope');
  await page.route('**/games/nope.json', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/?mode=guess&log=nope');
  await expect(page.getByRole('alert')).toContainText('No log named "nope"');
  await page.goto('/?mode=guess&episode=tomorrow');
  await expect(page.getByRole('alert')).toContainText('episode must be');
});

test('an episode with no vote has nothing to guess and says so, with no 0/0', async ({ page }) => {
  const short = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  short.turns = short.turns.filter((t: { phase: string }) => t.phase === 'night' || t.phase === 'round_table').slice(0, 10);
  short.events = [];
  await page.route('**/games/sample.json', (r) => r.fulfill({ body: JSON.stringify(short), contentType: 'application/json' }));
  await page.goto('/?mode=guess&log=sample&episode=1');
  for (let i = 0; i < 60 && !(await page.getByTestId('score').count()); i++) await next(page).click();
  await expect(page.getByRole('heading', { level: 2, name: 'There was nothing to guess in this episode' })).toBeVisible();
  expect(await page.getByTestId('share-text').innerText()).toMatch(/^Round Table #1: nothing to guess in this one\n/);
  expect(await page.locator('body').innerText()).not.toContain('0/0');
});

test('the other pages still open at their own addresses', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Round Table replay' })).toBeVisible();
});
