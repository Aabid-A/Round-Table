import { execFileSync } from 'node:child_process';
import { copyFileSync, createReadStream, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// The runbook's last steps: build the static site, add the episodes and stats the way docs/EPISODE.md says, and host it from a
// folder on a plain static server (no routing, nothing but files). Every kind of page has to work from there.
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const FOLDER = '/shows/round-table/';

let server: Server;
let origin = '';

test.beforeAll(async () => {
  const work = mkdtempSync(join(tmpdir(), 'rt-static-'));
  const root = join(work, 'site');
  const site = join(root, FOLDER);
  const run = (...args: string[]) => execFileSync('npx', args, { stdio: 'pipe', env: { ...process.env, VITE_ROOM_SERVER: '' } });

  // npm run build:web, into a temporary folder
  run('vite', 'build', 'web', '--outDir', site, '--emptyOutDir');
  // npm run games -- --mock --seeds 1-2, then the episodes and stats steps
  const games = join(work, 'games');
  run('tsx', 'src/cli/games.ts', '--mock', '--seeds', '1-2', '--out', games);
  mkdirSync(join(site, 'games'), { recursive: true });
  for (const n of [1, 2]) copyFileSync(join(games, `mock-seed-${n}.json`), join(site, 'games', `episode-00${n}.json`));
  run('tsx', 'src/cli/episodes.ts', join(site, 'games'));
  run('tsx', 'src/cli/stats.ts', games, '--out', join(site, 'stats.json'));

  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] as string));
    let file = join(root, path);
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      statSync(file);
    } catch {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** Errors the page reports to its console, or throws (the missing favicon is not one). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/favicon.ico') && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('the episode list shows the two episodes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${origin}${FOLDER}?page=episodes`);
  await expect(page.getByRole('heading', { level: 1, name: 'Guess the traitor' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Episode 1/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Episode 2/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the guess page plays an episode by number', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${origin}${FOLDER}?mode=guess&episode=1`);
  await expect(page.getByText('Episode 1', { exact: false }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('the stats page reads stats.json', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${origin}${FOLDER}?page=stats`);
  await expect(page.getByText('2 games', { exact: false }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a recording-mode clip plays by itself and reaches done', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${origin}${FOLDER}?mode=record&log=episode-001&from=0&to=6&speed=20`);
  await expect(page.locator('.rec[data-done="true"]')).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('the replay page opens a log by name, and a missing one says so', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${origin}${FOLDER}?log=episode-002`);
  await expect(page.getByText('seed 2', { exact: false }).first()).toBeVisible();
  await page.goto(`${origin}${FOLDER}?log=no-such-episode`);
  await expect(page.getByText('No log named', { exact: false })).toBeVisible();
  expect(errors.filter((e) => !e.includes('404'))).toEqual([]); // the missing log is a 404 on purpose
});
