import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { writeGameLog } from '../../src/log/writer.js';
import { playMock } from '../helpers/game.js';

// Each case starts tsx, a dev server and Chromium, which is slow when the whole suite runs in parallel.
const SLOW = 180_000;
let logPath = '';
let turnId = 0;
beforeAll(async () => {
  const log = await playMock(1);
  logPath = writeGameLog(log, mkdtempSync(join(tmpdir(), 'rt-card-')), 'mock-seed-1');
  turnId = log.turns.find((t) => t.phase === 'round_table')!.id;
}, SLOW);

const run = (...args: string[]) => spawnSync('npx', ['tsx', 'src/cli/card.ts', ...args], { encoding: 'utf8' });

/** Width and height from a PNG's header. */
function pngSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe('npm run card', () => {
  it('saves both card sizes as PNGs of exactly those sizes', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'rt-card-out-')), 'cards');
    const r = run(logPath, String(turnId), '--out', out);
    expect(r.status, r.stderr).toBe(0);
    const wide = join(out, `mock-seed-1-turn-${turnId}-1200x675.png`);
    const tall = join(out, `mock-seed-1-turn-${turnId}-1080x1350.png`);
    expect(r.stdout.trim().split('\n')).toEqual([wide, tall]);
    expect(pngSize(wide)).toEqual({ width: 1200, height: 675 });
    expect(pngSize(tall)).toEqual({ width: 1080, height: 1350 });
    expect(statSync(wide).size).toBeGreaterThan(5000);
  }, SLOW);

  it('saves one size with --size, and uses --name for the file name', () => {
    const out = mkdtempSync(join(tmpdir(), 'rt-card-out-'));
    const r = run(logPath, String(turnId), '--size', '1080x1350', '--name', 'episode-1', '--out', out);
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(out, `episode-1-turn-${turnId}-1080x1350.png`))).toBe(true);
    expect(existsSync(join(out, `episode-1-turn-${turnId}-1200x675.png`))).toBe(false);
  }, SLOW);

  it('exits 1 with a message, before opening a browser, for bad arguments, an unknown turn and a missing file', () => {
    const cases: [string[], string][] = [
      [[], 'usage:'],
      [[logPath], 'usage:'],
      [[logPath, 'abc'], '<turn id> must be a whole number'],
      [[logPath, '1', '--size', '800x600'], '--size must be'],
      [[logPath, '1', '--name', '../x'], 'not a plain log name'],
      [[logPath, '99999'], 'There is no turn 99999'],
      [[join(tmpdir(), 'rt-no-such-log.json'), '1'], 'ENOENT'],
    ];
    for (const [args, why] of cases) {
      const r = run(...args);
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stderr, args.join(' ')).toContain(why);
    }
  }, SLOW);
});
