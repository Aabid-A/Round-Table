import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-stats.json';

async function open(page: Page, query = ''): Promise<void> {
  await page.route('**/stats.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?page=stats${query}`);
}

const names = (page: Page): Promise<string[]> => page.locator('tbody th').allInnerTexts();

test('shows one row per model, best betrayal index first, with the summary', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Season stats' })).toBeVisible();
  await expect(page.getByText('2 games (2 with a winner) · 4 models')).toBeVisible();
  expect(await names(page)).toEqual(['model-b', 'model-a', 'model-c', 'model-d']);
  const first = page.locator('tbody tr').first();
  await expect(first).toContainText('2.00');
  await expect(first).toContainText('1/1 (100%)'); // traitor wins
  await expect(page.getByRole('columnheader', { name: /Betrayal index/ })).toHaveAttribute('aria-sort', 'descending');
});

test('sorts by a column and flips the direction on a second click', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Games' }).click();
  expect((await names(page))[0]).toBe('model-c');
  await expect(page.getByRole('columnheader', { name: /Games/ })).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Games' }).click();
  expect((await names(page)).at(-1)).toBe('model-c');
  await expect(page.getByRole('columnheader', { name: /Games/ })).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: 'Model' }).click();
  expect(await names(page)).toEqual(['model-a', 'model-b', 'model-c', 'model-d']);
  await expect(page.getByRole('columnheader', { name: /Betrayal index/ })).toHaveAttribute('aria-sort', 'none');
});

test('says how to create stats.json when it is missing', async ({ page }) => {
  await page.route('**/stats.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?page=stats');
  await expect(page.getByRole('alert')).toContainText('No stats.json in web/public/. Create it with npm run stats');
  await expect(page.getByText('Choose a stats file')).toBeVisible();
});

test('loads a chosen file, and rejects another statsVersion with a clear message', async ({ page }) => {
  await page.route('**/stats.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?page=stats');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('stats-table')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'old.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...JSON.parse(readFileSync(FIXTURE, 'utf8')), statsVersion: 2 })),
  });
  await expect(page.getByRole('alert')).toHaveText('These stats use statsVersion 2. This page reads statsVersion 1.');
});

test('says so for a season with no games, and reads ?stats=<name>', async ({ page }) => {
  await page.route('**/empty.json', (route) => route.fulfill({ body: JSON.stringify({ statsVersion: 1, games: 0, decidedGames: 0, models: [] }), contentType: 'application/json' }));
  await page.goto('/?page=stats&stats=empty');
  await expect(page.getByRole('status')).toContainText('No games in these stats yet');
  await expect(page.getByTestId('stats-table')).toHaveCount(0);
});

test('is reachable by keyboard: the table region and the sort buttons take focus', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('stats-table')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Model stats' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Model' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await names(page))[0]).toBe('model-a');
});

test('the replay page still loads at the plain address', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Round Table replay' })).toBeVisible();
});
