import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-game.json';

// These tests cover the flat replay table, which is the 3D room's fallback; replay-3d.e2e.ts covers the room.
async function openFixture(page: Page): Promise<void> {
  await page.goto('/?fallback=1');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('section')).toContainText('Night');
}

const counter = async (page: Page): Promise<number[]> => {
  const text = (await page.getByRole('slider', { name: 'Step' }).getAttribute('aria-valuetext')) ?? '';
  return (/Step (\d+) of (\d+)/.exec(text) ?? []).slice(1).map(Number);
};

test('loads the sample log and steps through to the result', async ({ page }) => {
  await openFixture(page);
  const [, total] = await counter(page);
  expect(total).toBeGreaterThan(40);
  await expect(page.getByTestId('table').getByRole('listitem')).toHaveCount(8);

  for (let i = 1; i < total!; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('section')).not.toBeEmpty();
  }
  expect(await counter(page)).toEqual([total, total]);
  await expect(page.getByTestId('result')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /^The (traitors|faithfuls) win$/ })).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('result')).toBeHidden();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Watch again' }).click();
  expect(await counter(page)).toEqual([1, total]);
});

test('shows who speaks and what the round table says', async ({ page }) => {
  await openFixture(page);
  for (let i = 0; i < 80 && !(await page.getByTestId('section').innerText()).startsWith('Round table'); i++) {
    await page.keyboard.press('ArrowRight');
  }
  await expect(page.getByTestId('section')).toContainText('Round table');
  await expect(page.getByTestId('bubble')).toBeVisible();
  await expect(page.locator('.seat[data-speaking=true]')).toHaveCount(1);
  await expect(page.getByText('Suspects', { exact: true })).toBeVisible();
});

test('space plays and pauses, and playing advances the steps', async ({ page }) => {
  await openFixture(page);
  const play = page.getByRole('button', { name: /^(Play|Pause)$/ });
  await expect(play).toHaveText('Play');
  await page.keyboard.press('Space');
  await expect(play).toHaveText('Pause');
  await expect.poll(async () => (await counter(page))[0], { timeout: 8000 }).toBeGreaterThan(1);
  await page.keyboard.press('Space');
  await expect(play).toHaveText('Play');
  const at = (await counter(page))[0];
  await page.waitForTimeout(2000);
  expect((await counter(page))[0]).toBe(at);
});

test('private notes are hidden until switched on, and labelled hidden from players', async ({ page }) => {
  await openFixture(page);
  await expect(page.getByTestId('notes')).toHaveCount(0);
  await page.getByLabel('Show private notes').check();
  const notes = page.getByTestId('notes');
  await expect(notes).toBeVisible();
  await expect(notes).toContainText('Hidden from players');
  await expect(notes).toContainText('MOCKNOTE');
  await page.getByLabel('Show private notes').uncheck();
  await expect(notes).toHaveCount(0);
});

test('arrow keys still step after the notes switch was used', async ({ page }) => {
  await openFixture(page);
  await page.getByLabel('Show private notes').check();
  const before = (await counter(page))[0]!;
  await page.keyboard.press('ArrowRight');
  expect((await counter(page))[0]).toBe(before + 1);
  await page.keyboard.press('ArrowLeft');
  expect((await counter(page))[0]).toBe(before);
  await expect(page.getByLabel('Show private notes')).toBeChecked();
});

test('announces each step to screen readers when stepping by hand, and stays quiet while playing', async ({ page }) => {
  await openFixture(page);
  const note = page.getByTestId('announcement');
  await expect(note).toHaveAttribute('role', 'status');
  await expect(note).toContainText(/Proposes murdering/);
  await page.keyboard.press('Space');
  await expect(note).toHaveText('');
  await page.keyboard.press('Space');
  await expect(note).not.toHaveText('');
  await expect(page.getByRole('button', { name: /^(Play|Pause)$/ })).not.toHaveAttribute('aria-pressed', /.*/);
});

test('a log that parses but cannot be drawn shows a message instead of a blank page', async ({ page }) => {
  // The murder event passes the shape check but has no proposals, so drawing it throws.
  const broken = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  delete broken.events.find((e: { type: string }) => e.type === 'murder').proposals;
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) });
  // Every step is described up front, so the error shows as soon as the log is opened.
  await expect(page.getByRole('alert')).toContainText('This log could not be shown');
  await expect(page.getByText('Choose a game log')).toBeVisible();
  // And a good log still loads afterwards.
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('section')).toContainText('Night');
});

test('rejects a log with another schemaVersion with a clear message', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'old.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 2 })),
  });
  await expect(page.getByRole('alert')).toHaveText('This log uses schemaVersion 2. This viewer reads schemaVersion 1.');
  await expect(page.getByText('Choose a game log')).toBeVisible();
});

test('loads a log named in the address, and says when it is missing', async ({ page }) => {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto('/?log=sample');
  await expect(page.getByTestId('section')).toContainText('Night');
  await page.goto('/?log=missing-game');
  await expect(page.getByRole('alert')).toContainText('No log named "missing-game"');
});
