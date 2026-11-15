import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { makeRoom } from './rooms-helpers.js';

test.setTimeout(180_000);
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
test.use({ launchOptions: { ...(existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } });

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as {
  cast: { name: string }[];
  turns: { player: string; attempts: { prompt: string }[] }[];
};

test('a room’s seat plays in the 3D room, from your own chair, with the turn’s time on the table', async ({ page }) => {
  await makeRoom(page, 'Quinn', '&seed=2&quality=low', { room3d: true });
  await page.getByRole('button', { name: 'Start the game' }).click();
  // The first turn a seat is told anything in shows the room; the clock in words stays beside the form.
  const world = page.getByTestId('world');
  await expect(world.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world).toHaveAttribute('data-first', 'true');
  await expect(page.getByTestId('turn-form')).toBeVisible({ timeout: 30_000 });
  await expect(world).toHaveAttribute('data-timer', 'shown');
  await expect(page.getByTestId('clock')).toContainText('Time left');
});

test('a room opened with ?fallback=1 keeps the flat room', async ({ page }) => {
  await makeRoom(page, 'Quinn', '&seed=2&fallback=1');
  await page.getByRole('button', { name: 'Start the game' }).click();
  await expect(page.getByTestId('turn-form')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('room')).toBeVisible();
  await expect(page.getByTestId('world')).toHaveCount(0);
});

test('a ghost watches from the chosen seat’s chair in the 3D room (scripted server)', async ({ page }) => {
  const promptOf = (name: string): string | null => sample.turns.find((t) => t.player === name)?.attempts[0]?.prompt ?? null;
  const seats = sample.cast.map((c) => ({ name: c.name, status: c.name === 'Aria' ? ('murdered' as const) : ('alive' as const), prompt: promptOf(c.name) }));
  await page.routeWebSocket(/:8788/, (ws) => {
    ws.onMessage((raw) => {
      const m = JSON.parse(String(raw)) as { t: string };
      if (m.t === 'create') {
        ws.send(JSON.stringify({ t: 'joined', code: 'AB2CD', token: '3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f', you: 'Aria', host: true }));
        ws.send(JSON.stringify({ t: 'lobby', code: 'AB2CD', mode: 'mock', aliases: false, ghosts: true, spectators: false, seats: [{ name: 'Aria', connected: true, host: true }], aiSeats: 7, maxHumans: 8 }));
      } else if (m.t === 'start') {
        ws.send(JSON.stringify({ t: 'status', phase: 'round_table' }));
        ws.send(JSON.stringify({ t: 'ghost', you: 'Aria', seats }));
      }
    });
  });
  await page.goto('/?mode=room&quality=low');
  const create = page.getByRole('region', { name: 'Make a room' });
  await create.getByLabel('Your name at the table').fill('Aria2');
  await create.getByTestId('ghosts-option').check();
  await create.getByRole('button', { name: 'Make room' }).click();
  await page.getByRole('button', { name: 'Start the game' }).click();

  const ghost = page.getByTestId('ghost');
  await ghost.getByTestId('ghost-seat').filter({ hasText: 'Bram' }).click();
  const world = page.getByRole('group', { name: 'The room as Bram sees it' });
  await expect(world.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(world).toHaveAttribute('data-first', 'true');
  await expect(world).toHaveAttribute('data-figures', /\d/);
  // Moving to another seat moves the chair.
  await ghost.getByTestId('ghost-seat').filter({ hasText: 'Dax' }).click();
  await expect(page.getByRole('group', { name: 'The room as Dax sees it' })).toBeVisible();
  await expect(page.getByTestId('turn-form')).toHaveCount(0);
});
