import { expect, type Page } from '@playwright/test';

/** Make a room with practice AIs. Returns its code. */
export async function makeRoom(page: Page, name: string, query = ''): Promise<string> {
  await page.goto(`/?mode=room${query}`);
  const create = page.getByRole('region', { name: 'Make a room' });
  await create.getByLabel('Your name at the table').fill(name);
  await create.getByRole('button', { name: 'Make room' }).click();
  await expect(page.getByTestId('lobby')).toBeVisible();
  return (await page.getByTestId('room-code').innerText()).trim();
}

/** Join through an invite link, as a friend would. */
export async function joinByInvite(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`/?mode=room&room=${code}`);
  const join = page.getByRole('region', { name: `Join room ${code}` });
  await join.getByLabel('Your name at the table').fill(name);
  await join.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByTestId('lobby')).toBeVisible();
}

/**
 * Answer this person's turns until the end screen shows. Returns the turns answered.
 * Stops early (returning what it has) if the page shows the room-closed screen.
 * `forbid` lists text that must never be on the page while playing, such as other people's notes.
 * `speech` is what to say at the round table; `seen` collects the "What you know" text of each turn.
 */
export async function playTurns(page: Page, note: string, forbid: string[] = [], opts: { speech?: string; seen?: string[] } = {}): Promise<number> {
  let answered = 0;
  const seen = new Set<string>();
  for (let n = 0; n < 200; n++) {
    const form = page.getByTestId('turn-form');
    const end = page.getByTestId('room-end');
    const closed = page.getByTestId('room-closed');
    await expect(form.or(end).or(closed)).toBeVisible({ timeout: 30_000 });
    if ((await end.isVisible()) || (await closed.isVisible())) break;
    const turn = (await form.getAttribute('data-turn')) ?? '';
    if (seen.has(turn)) {
      // The same turn is still showing: our answer is on its way. Wait for the page to move on.
      await expect(page.locator(`[data-testid=turn-form][data-turn="${turn}"]`)).toBeHidden({ timeout: 30_000 }).catch(() => undefined);
      continue;
    }
    seen.add(turn);
    const phase = await form.getAttribute('data-phase');
    const body = await page.locator('body').innerText();
    for (const text of forbid) expect(body, `"${text}" must not be shown during play`).not.toContain(text);
    opts.seen?.push(await form.locator('pre.prompt').innerText());
    if (phase === 'whispers') await form.getByLabel('Send no whisper').check();
    else if (phase === 'recruit_choose') await form.getByLabel('Make no offer').check();
    else await form.locator('input[type=radio]').first().check();
    if (phase === 'round_table') {
      await form.locator('textarea').fill(opts.speech ?? 'I speak.');
      await form.getByLabel(/Why you suspect them/).fill('because');
    }
    await form.getByLabel(/Your private note/).fill(note);
    await form.getByRole('button', { name: 'Send' }).click();
    answered++;
  }
  return answered;
}

/**
 * Lets a test slow down the turns the server sends this page, so a short-lived screen (the waiting line after you answer) can be
 * looked at without a race. Call it before opening the page; then set `window.__hold` to a number of milliseconds, and back to 0.
 */
export async function holdTurns(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
    if (!original) return;
    Object.defineProperty(WebSocket.prototype, 'onmessage', {
      configurable: true,
      get: original.get as () => unknown,
      set(handler: ((e: MessageEvent) => void) | null) {
        original.set?.call(
          this,
          handler &&
            ((e: MessageEvent) => {
              const hold = (window as unknown as { __hold?: number }).__hold;
              try {
                if (hold && (JSON.parse(String(e.data)) as { t?: string }).t === 'turn') return void setTimeout(() => handler(e), hold);
              } catch {
                /* not JSON: pass it on */
              }
              handler(e);
            }),
        );
      },
    });
  });
}
