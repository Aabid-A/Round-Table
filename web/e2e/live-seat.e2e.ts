import { expect, test, type Page } from '@playwright/test';
import { makeRoom } from './rooms-helpers.js';

test.setTimeout(120_000);

// Seeds found by simulation (the practice AIs are seeded): with the human named Sam,
//  5 = faithful, murdered Aria on the first night; 6 = faithful who is whispered to; 1 = traitor, and the first turn is a night turn.
const FAITHFUL = 5;
const WHISPERED = 6;
const TRAITOR = 1;

async function startSolo(page: Page, seed: number): Promise<void> {
  await page.goto(`/?mode=play&seed=${seed}`);
  await page.getByLabel(/Your name at the table/).fill('Sam');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible();
}

const form = (page: Page) => page.getByTestId('turn-form');
const turnNo = async (page: Page): Promise<number> => Number(await form(page).getAttribute('data-turn'));

/** Answer a turn with the form, whatever the phase. */
async function answerWithForm(page: Page): Promise<void> {
  const phase = await form(page).getAttribute('data-phase');
  if (phase === 'whispers') await form(page).getByLabel('Send no whisper').check();
  else if (phase === 'recruit_choose') await form(page).getByLabel('Make no offer').check();
  else await form(page).locator('input[type=radio]').first().check();
  if (phase === 'round_table') {
    await form(page).locator('textarea').fill('I speak.');
    await form(page).getByLabel(/Why you suspect them/).fill('because');
  }
  await page.getByTestId('live-send').click();
}

/** Answer turns with the form until the next turn is one in `phase`. */
async function goToPhase(page: Page, phase: string): Promise<void> {
  for (let i = 0; i < 40 && (await form(page).getAttribute('data-phase')) !== phase; i++) {
    const n = await turnNo(page);
    await answerWithForm(page);
    await expect(page.locator(`[data-testid=turn-form][data-turn="${n + 1}"]`)).toBeVisible({ timeout: 30_000 });
  }
  expect(await form(page).getAttribute('data-phase')).toBe(phase);
}

const chairs = (page: Page) => page.locator('[data-testid=room-seat] button.room-chair:not([disabled])');

test('the room is first person: your chair is not in the picture, and a murdered seat is an empty chair', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  const room = page.getByTestId('room');
  await expect(room).toHaveAttribute('data-pov', 'first');
  await expect(room.locator('[data-mark=self]')).toHaveCount(0);
  await expect(room.getByTestId('room-seat')).toHaveCount(7);
  const empty = room.locator('[data-empty=true]');
  await expect(empty).toHaveCount(1);
  await expect(empty).toContainText('Murdered');
  await expect(room.locator('[data-name=Aria]')).toHaveAttribute('data-status', 'murdered');
});

test('pick a seat in the room, then confirm: the turn is sent, and the form shows the same choice', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await goToPhase(page, 'vote');
  const n = await turnNo(page);
  await expect(page.getByTestId('live-send')).toBeDisabled();
  await expect(page.getByTestId('room-sleep')).toHaveCount(0, { timeout: 8000 }); // the dark of the night ends first
  await page.evaluate(() => window.scrollTo(0, 0));
  const first = chairs(page).first();
  const name = (await first.locator('.room-name').innerText()).trim();
  const box = (await first.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(form(page).getByLabel(name, { exact: true })).toBeChecked(); // the form follows the room
  await expect(page.getByTestId('live-chosen')).toContainText(`You chose ${name}`);
  await expect(page.getByTestId('live-send')).toBeEnabled();
  await page.getByTestId('live-send').click();
  await expect(page.locator(`[data-testid=turn-form][data-turn="${n}"]`)).toBeHidden();
});

test('what you pick in the form shows in the room', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await goToPhase(page, 'vote');
  const radio = form(page).locator('input[type=radio]').nth(1);
  await radio.check();
  await expect(page.locator('[data-testid=room-seat] [aria-pressed=true]')).toHaveCount(1);
  await expect(page.getByTestId('live-send')).toBeEnabled();
});

test('everything can be done with the keyboard: arrows walk the seats, Enter picks, Escape clears, Confirm sends', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await goToPhase(page, 'vote');
  const n = await turnNo(page);
  await expect(page.getByTestId('room-sleep')).toHaveCount(0, { timeout: 8000 }); // the room is out of reach while it is dark
  const all = chairs(page);
  expect(await all.count()).toBeGreaterThan(2);
  await all.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(all.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(all.first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(all.first()).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(all.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('live-send')).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(all.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('live-send')).toBeEnabled(); // a disabled button cannot take focus
  await page.getByTestId('live-send').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-testid=turn-form][data-turn="${n}"]`)).toBeHidden();
});

test('a faithful’s screen goes dark for the night, then they wake to the news', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  await expect(page.getByTestId('room-sleep')).toBeVisible();
  await expect(page.getByTestId('room-sleep')).toContainText('You are asleep');
  await expect(page.getByTestId('room-sleep')).toBeHidden({ timeout: 8000 });
  await expect(page.getByTestId('room-caption')).toContainText(/Breakfast|Whispers/);
});

test('a traitor stays in a dim room, sees the other traitor, and can only choose a faithful', async ({ page }) => {
  await startSolo(page, TRAITOR);
  expect(await form(page).getAttribute('data-phase')).toBe('night');
  const room = page.getByTestId('room');
  await expect(room).toHaveAttribute('data-night', 'true');
  await expect(page.getByTestId('room-sleep')).toHaveCount(0);
  await expect(room.locator('[data-mark=fellow]')).toHaveCount(1);
  await expect(room.locator('[data-mark=fellow]')).toContainText('Fellow traitor');
  // The traitors cannot murder each other: their fellow's chair is not one to choose.
  const fellow = (await room.locator('[data-mark=fellow]').getAttribute('data-name'))!;
  await expect(room.locator(`[data-name=${fellow}] button`)).toBeDisabled();
  expect(await chairs(page).count()).toBe(6); // all six faithfuls, and not the other traitor
});

test('a whisper to you leans its sender in toward you', async ({ page }) => {
  await startSolo(page, WHISPERED);
  let sender: string | null = null;
  for (let i = 0; i < 30 && sender === null; i++) {
    const knows = await form(page).locator('pre.prompt').innerText();
    const m = /(\w+) whispered to you:/.exec(knows);
    if (m) {
      sender = m[1]!;
      break;
    }
    const n = await turnNo(page);
    await answerWithForm(page);
    await expect(page.locator(`[data-testid=turn-form][data-turn="${n + 1}"]`)).toBeVisible({ timeout: 30_000 });
  }
  expect(sender).not.toBeNull();
  await expect(page.locator(`[data-name=${sender}]`)).toHaveAttribute('data-leaning', 'true', { timeout: 15_000 });
  await expect(page.getByTestId('room-speech')).toContainText('Whispers to you');
});

test('while you play as a faithful, no living seat shows a role and no AI note is on the page', async ({ page }) => {
  await startSolo(page, FAITHFUL);
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('end').isVisible()) break;
    const n = await turnNo(page);
    await expect(page.locator('[data-status=alive] [data-testid=room-role]')).toHaveCount(0);
    await expect(page.locator('[data-mark=traitor]')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('MOCKNOTE');
    await answerWithForm(page);
    await expect(page.locator(`[data-testid=turn-form][data-turn="${n + 1}"]`).or(page.getByTestId('end'))).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.getByTestId('end')).toBeVisible();
});

test('reduced motion: nothing glides or fades in the room', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startSolo(page, FAITHFUL);
  await expect(page.locator('.room-stage')).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('.room-seat .room-stand').first()).toHaveCSS('transition-duration', '0s');
  await expect(page.getByTestId('room-sleep')).toHaveCSS('animation-name', 'none');
});

test('in a room with friends the clock is drawn in the room, and the room is first person too', async ({ page }) => {
  await makeRoom(page, 'Quinn', '&seed=5');
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible({ timeout: 30_000 });
  const room = page.getByTestId('room');
  await expect(room).toHaveAttribute('data-pov', 'first');
  const timer = page.getByTestId('room-timer');
  await expect(timer).toBeVisible();
  const read = async (): Promise<number> => Number(/(\d+)s/.exec((await timer.innerText()))![1]);
  const before = await read();
  await page.waitForTimeout(2200);
  expect(await read()).toBeLessThan(before);
  await expect(page.getByTestId('clock')).toBeVisible(); // the written clock stays beside it
});
