import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { writeGameLog } from '../../src/log/writer.js';
import type { SeasonStats } from '../../src/log/stats.js';
import { playMock } from '../helpers/game.js';

// Each case starts a tsx process, which is slow when the whole suite runs in parallel.
const SLOW = 60_000;
let dir = '';
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'rt-stats-'));
  for (const seed of [1, 2, 3]) writeGameLog(await playMock(seed), dir, `mock-seed-${seed}`);
  writeFileSync(join(dir, 'broken.json'), 'x');
}, SLOW);

const run = (...args: string[]) => spawnSync('npx', ['tsx', 'src/cli/stats.ts', ...args], { encoding: 'utf8' });

describe('npm run stats', () => {
  it('prints season stats as JSON and reports skipped files on stderr', () => {
    const r = run(dir);
    expect(r.status).toBe(0);
    const stats = JSON.parse(r.stdout) as SeasonStats;
    expect(stats).toMatchObject({ statsVersion: 1, games: 3, decidedGames: 3 });
    expect(stats.models[0]).toMatchObject({ model: 'mock', games: 24 });
    expect(r.stderr).toContain('skipped broken.json');
  }, SLOW);

  it('writes a file with --out and prints its path', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'rt-stats-out-')), 'stats.json');
    const r = run(dir, '--out', out);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(out);
    expect((JSON.parse(readFileSync(out, 'utf8')) as SeasonStats).games).toBe(3);
  }, SLOW);

  it('creates the folder for --out, and fails before reading when it cannot', () => {
    const base = mkdtempSync(join(tmpdir(), 'rt-stats-out-'));
    const nested = join(base, 'a', 'b', 'stats.json');
    expect(run(dir, '--out', nested).status).toBe(0);
    expect((JSON.parse(readFileSync(nested, 'utf8')) as SeasonStats).games).toBe(3);
    const blocker = join(base, 'file');
    writeFileSync(blocker, 'x');
    const bad = run(dir, '--out', join(blocker, 'stats.json'));
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/ENOTDIR|EEXIST/);
    expect(bad.stderr).not.toContain('skipped broken.json'); // it never got as far as reading the logs
  }, SLOW);

  it('warns about an empty folder and exits 1 for no argument or a missing folder', () => {
    const empty = run(mkdtempSync(join(tmpdir(), 'rt-stats-empty-')));
    expect(empty.status).toBe(0);
    expect(empty.stderr).toContain('no game logs found');
    expect(JSON.parse(empty.stdout)).toMatchObject({ games: 0, models: [] });
    expect(run().status).toBe(1);
    expect(run().stderr).toContain('usage:');
    const missing = run(join(tmpdir(), 'rt-no-such-folder'));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('ENOENT');
  }, SLOW);
});
