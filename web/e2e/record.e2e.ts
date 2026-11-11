import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/sample-game.json';
const log = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  turns: { id: number; phase: string; speech: string; private_notes: string; player: string }[];
};

async function open(page: Page, query: string): Promise<void> {
  await page.route('**/games/sample.json', (route) => route.fulfill({ path: FIXTURE }));
  await page.goto(`/?mode=record&log=sample${query}`);
}

/** Records every value data-turn takes, in order, so a test can see what a clip played. */
async function trackTurns(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    new MutationObserver(() => {
      const el = document.querySelector('.rec');
      const v = el?.getAttribute('data-turn');
      if (v !== null && v !== undefined && seen.at(-1) !== v) seen.push(v);
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
}

const seen = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);

test('has no controls or chrome', async ({ page }) => {
  await open(page, '&speed=20');
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveCount(0);
  await expect(page.locator('input, header, footer, nav')).toHaveCount(0);
  await expect(page.getByText('Show private notes')).toHaveCount(0);
});

test('16x9 and 9x16 give a stage of that shape', async ({ page }) => {
  for (const [aspect, viewport, ratio] of [
    ['16x9', { width: 1280, height: 720 }, 16 / 9],
    ['16x9', { width: 800, height: 1200 }, 16 / 9],
    ['9x16', { width: 720, height: 1280 }, 9 / 16],
    ['9x16', { width: 1280, height: 720 }, 9 / 16],
  ] as const) {
    await page.setViewportSize(viewport);
    await open(page, `&aspect=${aspect}&speed=20`);
    const box = (await page.getByTestId('stage').boundingBox())!;
    expect(box.width / box.height, `${aspect} in ${viewport.width}x${viewport.height}`).toBeCloseTo(ratio, 1);
    expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
});

test('plays only the turns in from..to, in order, then holds the last frame', async ({ page }) => {
  await trackTurns(page);
  await open(page, '&from=10&to=13&speed=20');
  await expect(page.locator('.rec')).toHaveAttribute('data-done', 'true', { timeout: 8000 });
  const turns = (await seen(page)).filter((v) => v !== '').map(Number);
  expect(turns[0]).toBe(10);
  expect(turns.at(-1)).toBe(13);
  expect(turns.every((t) => t >= 10 && t <= 13)).toBe(true);
  expect(turns).toEqual([...turns].sort((a, b) => a - b));
  const held = await page.locator('.rec').getAttribute('data-step');
  await page.waitForTimeout(500);
  await expect(page.locator('.rec')).toHaveAttribute('data-step', held!);
});

test('paces steps by reading time (a clip at speed 1 does not rush)', async ({ page }) => {
  await open(page, '&from=0&to=1');
  await expect(page.locator('.rec')).toHaveAttribute('data-step', '0');
  const start = Date.now();
  await expect(page.locator('.rec')).toHaveAttribute('data-step', '1', { timeout: 8000 });
  expect(Date.now() - start).toBeGreaterThan(1000);
});

test('two faces shows what was said beside what was privately written', async ({ page }) => {
  const turn = log.turns.find((t) => t.phase === 'round_table')!;
  await open(page, `&faces=${turn.id}`);
  await expect(page.getByTestId('faces')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(turn.player);
  await expect(page.getByTestId('face-said')).toContainText(turn.speech);
  await expect(page.getByTestId('face-wrote')).toContainText(turn.private_notes);
  await expect(page.getByTestId('face-wrote')).toContainText('hidden from players');
  await expect(page.locator('.rec')).toHaveAttribute('data-done', 'true');
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('two faces works in both shapes', async ({ page }) => {
  const turn = log.turns.find((t) => t.phase === 'round_table')!;
  for (const aspect of ['16x9', '9x16']) {
    await open(page, `&aspect=${aspect}&faces=${turn.id}`);
    const said = (await page.getByTestId('face-said').boundingBox())!;
    const wrote = (await page.getByTestId('face-wrote').boundingBox())!;
    if (aspect === '16x9') expect(Math.abs(said.y - wrote.y)).toBeLessThan(2); // side by side
    else expect(wrote.y).toBeGreaterThan(said.y + said.height - 1); // stacked
  }
});

test('says what is wrong with the URL as plain text', async ({ page }) => {
  await open(page, '&aspect=4x3');
  await expect(page.getByRole('alert')).toContainText('aspect must be 16x9 or 9x16');
  await open(page, '&from=900&to=950');
  await expect(page.getByRole('alert')).toContainText('No steps between turn 900');
  await open(page, '&faces=9999');
  await expect(page.getByRole('alert')).toContainText('There is no turn 9999');
  await page.goto('/?mode=record');
  await expect(page.getByRole('alert')).toContainText('needs ?log=');
});
