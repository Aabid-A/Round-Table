import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = Array.from({ length: 7 }, (_, i) => `vendor/model-${i + 1}`).join('\n');

/** Answer the human's turns until the end screen appears. Returns how many turns were answered. */
async function playThrough(page: Page, note = 'my note'): Promise<number> {
  let answered = 0;
  for (let n = 1; n < 120; n++) {
    const form = page.locator(`[data-testid=turn-form][data-turn="${n}"]`);
    const end = page.getByTestId('end');
    await expect(form.or(end)).toBeVisible({ timeout: 30_000 });
    if (await end.isVisible()) break;
    const phase = await form.getAttribute('data-phase');
    const body = await page.locator('body').innerText();
    expect(body, 'no AI private notes shown during play').not.toContain('MOCKNOTE');
    if (phase === 'whispers') await form.getByLabel('Send no whisper').check();
    else if (phase === 'recruit_choose') await form.getByLabel('Make no offer').check();
    else await form.locator('input[type=radio]').first().check();
    if (phase === 'round_table') {
      await form.locator('textarea').fill('I speak.');
      await form.getByLabel(/Why you suspect them/).fill('because');
    }
    await form.getByLabel(/Your private note/).fill(note);
    await form.getByRole('button', { name: 'Send' }).click();
    answered++;
  }
  return answered;
}

async function startPractice(page: Page, name = 'Sam', query = 'seed=5'): Promise<void> {
  await page.goto(`/?mode=play&${query}`);
  await page.getByLabel('Your name at the table').fill(name);
  await page.getByRole('button', { name: 'Take a seat' }).click();
}

/** A fake OpenRouter that always answers validly, with a note that names the human. */
async function smartOpenRouter(page: Page, human: string): Promise<void> {
  await page.route(OPENROUTER, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { messages: { content: string }[] };
    const full = body.messages[1]?.content ?? '';
    const task = full.slice(full.lastIndexOf('\n\n') + 2);
    const options = /(?:Valid (?:targets|choices|suspects|recipients)|Faithfuls you can offer): ([^.]*)\./.exec(task)?.[1]?.split(', ') ?? [];
    let action: unknown;
    let speech = '';
    if (/^(Revote|Banishment vote|It is night)/.test(task)) action = { target: options[0] };
    else if (task.startsWith('Round table')) (action = { suspect: options[0], reason: 'x' }), (speech = 'I have a feeling.');
    else if (task.startsWith('Whispers.')) action = { to: null };
    else if (task.startsWith('Few players')) action = { choice: 'end' };
    else if (task.includes('secretly offers')) action = { accept: false };
    else action = { target: null };
    const content = JSON.stringify({ speech, private_notes: `${human} is hard to read, so I will keep watching ${human}.`, action });
    await route.fulfill({ body: JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 5, cost: 0.001 } }), contentType: 'application/json' });
  });
}

test('the setup checks the name, and real models need a key, seven models and a cap', async ({ page }) => {
  await page.goto('/?mode=play');
  await expect(page.getByRole('heading', { level: 1, name: 'Take a seat' })).toBeVisible();
  await page.getByLabel('Your name at the table').fill('Aria');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByRole('alert')).toContainText("already an AI's name");
  await page.getByLabel('Your name at the table').fill('Sam');
  await page.getByLabel(/Real models through OpenRouter/).check();
  await expect(page.getByLabel('Your OpenRouter key')).toHaveAttribute('type', 'password');
  await expect(page.getByTestId('key-note')).toContainText('only to OpenRouter, never saved');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter 7 model IDs');
  await page.getByLabel(/Seven model IDs/).fill(MODELS);
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByRole('alert')).toContainText('Paste your OpenRouter key');
  await page.getByLabel('Your OpenRouter key').fill('k');
  await page.getByLabel(/Spend cap/).fill('0');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByRole('alert')).toContainText('spend cap must be a number above 0');
});

test('a practice game: answer each turn, reach the end screen, and the log has the human as model "human"', async ({ page }) => {
  await startPractice(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Take a seat' })).toBeVisible();
  const answered = await playThrough(page);
  expect(answered).toBeGreaterThan(2);
  await expect(page.getByRole('heading', { level: 1, name: /win|stopped/i })).toBeVisible();
  await expect(page.getByTestId('reveal').getByRole('listitem')).toHaveCount(8);
  await expect(page.getByTestId('reveal')).toContainText('Sam (you)');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the game log' }).click()]);
  expect(download.suggestedFilename()).toBe('round-table-solo-seed-5.json');
  const log = JSON.parse(readFileSync((await download.path())!, 'utf8')) as { cast: { name: string; model: string }[]; turns: { player: string; private_notes: string; fallback: boolean }[]; schemaVersion: number };
  expect(log.schemaVersion).toBe(1);
  expect(log.cast.filter((c) => c.model === 'human').map((c) => c.name)).toEqual(['Sam']);
  const mine = log.turns.filter((t) => t.player === 'Sam');
  expect(mine).toHaveLength(answered);
  expect(mine.every((t) => t.private_notes === 'my note' && !t.fallback)).toBe(true);
});

test('what you know is shown as text, the task has no JSON-format lines, and the form matches the phase', async ({ page }) => {
  await startPractice(page);
  const form = page.locator('[data-testid=turn-form][data-turn="1"]');
  await expect(form).toBeVisible();
  const text = await form.innerText();
  expect(text).toContain('You are Sam. Your role:');
  expect(text).not.toContain('Action: {');
  expect(text).not.toContain('"speech"');
  const phase = await form.getAttribute('data-phase');
  const send = form.getByRole('button', { name: 'Send' });
  // Phases that allow "none" (no whisper, no offer) start complete; every other phase needs a choice first.
  if (phase === 'whispers' || phase === 'recruit_choose') await expect(send).toBeEnabled();
  else await expect(send).toBeDisabled();
  await form.locator('input[type=radio]').first().check();
  if (phase === 'round_table') await expect(send).toBeDisabled(); // still needs speech and a reason
});

test('the setup error goes away when you change a field, and each turn names its choices', async ({ page }) => {
  await page.goto('/?mode=play&seed=5');
  await page.getByLabel('Your name at the table').fill('Aria');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Your name at the table').fill('Sam');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Take a seat' }).click();
  const form = page.locator('[data-testid=turn-form][data-turn="1"]');
  await expect(form).toBeVisible();
  const legend = form.locator('fieldset.choices > legend');
  await expect(legend).toBeVisible(); // the choices have a visible heading
  expect((await legend.innerText()).trim()).not.toBe('');
  await expect(form.getByRole('group', { name: (await legend.innerText()).trim() })).toBeVisible();
});

test('quit goes back to the setup, and the game stops', async ({ page }) => {
  await startPractice(page);
  await expect(page.locator('[data-testid=turn-form]')).toBeVisible();
  await page.getByRole('button', { name: 'Quit this game' }).click();
  await expect(page.getByRole('button', { name: 'Take a seat' })).toBeVisible();
  await expect(page.locator('[data-testid=turn-form]')).toHaveCount(0);
});

test('quit really stops the game: no further calls to OpenRouter after it', async ({ page }) => {
  let calls = 0;
  await page.route(OPENROUTER, async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    await route.fulfill({ body: JSON.stringify({ choices: [{ message: { content: 'no json' } }], usage: { total_tokens: 5, cost: 0.0001 } }), contentType: 'application/json' }).catch(() => undefined);
  });
  await page.goto('/?mode=play&seed=5');
  await page.getByLabel('Your name at the table').fill('Sam');
  await page.getByLabel(/Real models through OpenRouter/).check();
  await page.getByLabel('Your OpenRouter key').fill('k');
  await page.getByLabel(/Seven model IDs/).fill(MODELS);
  await page.getByLabel(/Spend cap/).fill('100');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect.poll(() => calls, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Quit this game' }).click();
  await expect(page.getByRole('button', { name: 'Take a seat' })).toBeVisible();
  await page.waitForTimeout(300); // let anything already on the wire land
  const atQuit = calls;
  await page.waitForTimeout(1500);
  expect(calls).toBe(atQuit);
});

test('real models: the key goes only to OpenRouter, is not stored or shown, and the spend cap stops the game', async ({ page, context }) => {
  const KEY = 'sk-e2e-not-a-real-key';
  const requests: { url: string; headers: Record<string, string>; body: string }[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), headers: r.headers(), body: r.postData() ?? '' }));
  await page.route(OPENROUTER, (route) =>
    route.fulfill({ body: JSON.stringify({ choices: [{ message: { content: 'no json' } }], usage: { total_tokens: 5, cost: 0.6 } }), contentType: 'application/json' }),
  );
  await page.goto('/?mode=play&seed=5');
  await page.getByLabel('Your name at the table').fill('Sam');
  await page.getByLabel(/Real models through OpenRouter/).check();
  await page.getByLabel('Your OpenRouter key').fill(KEY);
  await page.getByLabel(/Seven model IDs/).fill(MODELS);
  await page.getByLabel(/Spend cap/).fill('1');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await playThrough(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Game stopped' })).toBeVisible();
  await expect(page.getByText('The game was stopped by your spend cap.')).toBeVisible();
  await expect(page.getByText(/Spent \$/)).toBeVisible();

  const toOpenRouter = requests.filter((r) => r.url === OPENROUTER);
  expect(toOpenRouter.length).toBeGreaterThan(0);
  expect(toOpenRouter.every((r) => r.headers.authorization === `Bearer ${KEY}`)).toBe(true);
  for (const r of requests.filter((x) => x.url !== OPENROUTER)) {
    expect(r.url, 'no other request carries the key').not.toContain(KEY);
    expect(JSON.stringify(r.headers)).not.toContain(KEY);
    expect(r.body).not.toContain(KEY);
  }
  expect(toOpenRouter.every((r) => !r.body.includes(KEY))).toBe(true);
  const stored = await page.evaluate(() => ({ local: JSON.stringify({ ...localStorage }), session: JSON.stringify({ ...sessionStorage }), cookie: document.cookie }));
  expect(stored).toEqual({ local: '{}', session: '{}', cookie: '' });
  expect(await context.cookies()).toEqual([]);
  expect(await page.locator('body').innerText()).not.toContain(KEY);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the game log' }).click()]);
  expect(readFileSync((await download.path())!, 'utf8')).not.toContain(KEY);
});

test('real models: what the AIs privately wrote about you is listed, and a card downloads as a 1200x675 PNG', async ({ page }) => {
  await smartOpenRouter(page, 'Sam');
  await page.goto('/?mode=play&seed=5');
  await page.getByLabel('Your name at the table').fill('Sam');
  await page.getByLabel(/Real models through OpenRouter/).check();
  await page.getByLabel('Your OpenRouter key').fill('k');
  await page.getByLabel(/Seven model IDs/).fill(MODELS);
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await playThrough(page);
  const list = page.getByTestId('notes-about-you');
  await expect(list).toBeVisible();
  await expect(list.getByRole('listitem').first()).toContainText('Sam is hard to read');
  await expect(list.getByRole('listitem').first()).toContainText('Thought, hidden from the players');
  const [download] = await Promise.all([page.waitForEvent('download'), list.getByRole('button').first().click()]);
  expect(download.suggestedFilename()).toMatch(/^round-table-.+-round-\d+\.png$/);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 675]);
});

test('a long list of notes about you shows the first six, and the rest on request', async ({ page }) => {
  await smartOpenRouter(page, 'Sam');
  await page.goto('/?mode=play&seed=5');
  await page.getByLabel('Your name at the table').fill('Sam');
  await page.getByLabel(/Real models through OpenRouter/).check();
  await page.getByLabel('Your OpenRouter key').fill('k');
  await page.getByLabel(/Seven model IDs/).fill(MODELS);
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await playThrough(page);
  const items = page.getByTestId('notes-about-you').getByRole('listitem');
  await expect(items).toHaveCount(6);
  const more = page.getByRole('button', { name: /Show all \d+ notes/ });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  const total = Number(/Show all (\d+) notes/.exec(await more.innerText())![1]);
  expect(total).toBeGreaterThan(6);
  await more.click();
  await expect(items).toHaveCount(total);
  await page.getByRole('button', { name: 'Show fewer' }).click();
  await expect(items).toHaveCount(6);
});

test('a practice game with no AI naming you says so, and play again returns to the setup', async ({ page }) => {
  await startPractice(page);
  await playThrough(page);
  await expect(page.getByTestId('no-notes')).toHaveText('No AI wrote about you by name this game.');
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('button', { name: 'Take a seat' })).toBeVisible();
});

test('the other pages still open at their own addresses', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Round Table replay' })).toBeVisible();
});
