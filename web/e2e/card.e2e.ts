import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-game.json';
const log = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  turns: { id: number; round: number; phase: string; speech: string; private_notes: string; player: string }[];
  cast: { name: string; model: string }[];
};
const turn = log.turns.find((t) => t.phase === 'round_table')!;

async function open(page: Page, query: string, body?: string): Promise<void> {
  await page.route('**/games/sample.json', (route) => (body ? route.fulfill({ body, contentType: 'application/json' }) : route.fulfill({ path: FIXTURE })));
  await page.goto(`/?${query}`);
}

test('draws the 1200x675 card at exactly that size, with the quote, the thought and where it came from', async ({ page }) => {
  await open(page, `card=${turn.id}&log=sample`);
  const card = page.getByTestId('card');
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  expect([box.width, box.height]).toEqual([1200, 675]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(turn.player);
  await expect(card).toContainText(log.cast.find((c) => c.name === turn.player)!.model);
  await expect(page.getByTestId('card-said')).toContainText(turn.speech);
  await expect(page.getByTestId('card-thought')).toContainText(turn.private_notes);
  await expect(page.getByTestId('card-said')).toContainText('Said');
  await expect(page.getByTestId('card-thought')).toContainText('Thought');
  await expect(page.getByTestId('card-foot')).toHaveText('The thought was hidden from the other players.');
  await expect(page.getByTestId('card-where')).toHaveText(`Game sample · Round ${turn.round} · Round table`);
  await expect(page.locator('.card-page')).toHaveAttribute('data-ready', 'true');
  await expect(page).toHaveTitle('Round Table card');
});

test('draws the 1080x1350 card at exactly that size, with the quotes stacked', async ({ page }) => {
  await open(page, `card=${turn.id}&log=sample&size=1080x1350`);
  const box = (await page.getByTestId('card').boundingBox())!;
  expect([box.width, box.height]).toEqual([1080, 1350]);
  const said = (await page.getByTestId('card-said').boundingBox())!;
  const thought = (await page.getByTestId('card-thought').boundingBox())!;
  expect(thought.y).toBeGreaterThan(said.y + said.height - 1);
});

test('puts the quotes side by side on the wide card', async ({ page }) => {
  await open(page, `card=${turn.id}&log=sample`);
  const said = (await page.getByTestId('card-said').boundingBox())!;
  const thought = (await page.getByTestId('card-thought').boundingBox())!;
  expect(Math.abs(said.y - thought.y)).toBeLessThan(2);
  expect(thought.x).toBeGreaterThan(said.x + said.width - 1);
});

test('a very long quote and a long name still fit inside the card', async ({ page }) => {
  const long = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const t = long.turns.find((x: { id: number }) => x.id === turn.id);
  t.speech = 'I have been thinking about this for a long time and I really do not trust how quiet some of you have been. '.repeat(8);
  t.private_notes = 'Deflect early, build an alliance with the loudest player, and keep the accusation vague so nobody can pin it on me. '.repeat(6);
  long.cast.find((c: { name: string }) => c.name === t.player).model = 'openrouter/anthropic/a-very-long-model-name-1234567890-abcdefghijklmnop';
  for (const size of ['1200x675', '1080x1350']) {
    await open(page, `card=${turn.id}&log=sample&size=${size}`, JSON.stringify(long));
    const card = (await page.getByTestId('card').boundingBox())!;
    for (const id of ['card-said', 'card-thought']) {
      const el = page.getByTestId(id);
      const box = (await el.boundingBox())!;
      expect(box.y + box.height, `${size} ${id}`).toBeLessThanOrEqual(card.y + card.height + 1);
      // Nothing is cut off: the text block is not taller than the panel that holds it.
      const fits = await el.evaluate((n) => n.scrollHeight <= n.clientHeight + 1);
      expect(fits, `${size} ${id} text fits`).toBe(true);
    }
  }
});

test('says what is wrong with the URL, an unknown turn and a missing log', async ({ page }) => {
  await open(page, 'card=abc&log=sample');
  await expect(page.getByRole('alert')).toContainText('card must be a turn id');
  await open(page, `card=${turn.id}&log=sample&size=800x600`);
  await expect(page.getByRole('alert')).toContainText('size must be 1200x675 or 1080x1350');
  await open(page, 'card=9999&log=sample');
  await expect(page.getByRole('alert')).toContainText('There is no turn 9999');
  await page.route('**/games/gone.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?card=1&log=gone');
  await expect(page.getByRole('alert')).toContainText('No log named "gone"');
});

test('the other pages still open at their own addresses', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Round Table replay' })).toBeVisible();
  await page.route('**/stats.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?page=stats');
  await expect(page.getByRole('heading', { level: 1, name: 'Season stats' })).toBeVisible();
});
