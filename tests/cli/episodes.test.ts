import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { EpisodeIndex } from '../../src/log/episodes.js';
import { writeGameLog } from '../../src/log/writer.js';
import { playMock } from '../helpers/game.js';

// Each case starts a tsx process, which is slow when the whole suite runs in parallel.
const SLOW = 60_000;
let dir = '';
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'rt-eps-'));
  writeGameLog(await playMock(2), dir, 'episode-002');
  writeGameLog(await playMock(1), dir, 'episode-001');
  writeFileSync(join(dir, 'broken.json'), 'x');
}, SLOW);

const run = (...args: string[]) => spawnSync('npx', ['tsx', 'src/cli/episodes.ts', ...args], { encoding: 'utf8' });

describe('npm run episodes', () => {
  it('writes <folder>/index.json with episodes in file name order, and reports skipped files', () => {
    const r = run(dir);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe(join(dir, 'index.json'));
    expect(r.stderr).toContain('skipped broken.json');
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as EpisodeIndex;
    expect(index.episodes.map((e) => [e.number, e.name])).toEqual([[1, 'episode-001'], [2, 'episode-002']]);
  }, SLOW);

  it('does not treat its own index.json as a log when run again', () => {
    expect(run(dir).status).toBe(0);
    expect(run(dir).stderr).not.toContain('index.json');
  }, SLOW);

  it('writes to --out, and exits 1 for no argument or a missing folder', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'rt-eps-out-')), 'x', 'eps.json');
    expect(run(dir, '--out', out).status).toBe(0);
    expect((JSON.parse(readFileSync(out, 'utf8')) as EpisodeIndex).episodes).toHaveLength(2);
    expect(run().status).toBe(1);
    expect(run().stderr).toContain('usage:');
    const missing = run(join(mkdtempSync(join(tmpdir(), 'rt-eps-miss-')), 'nope'));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('ENOENT');
  }, SLOW);

  it('does not create a missing input folder', () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'rt-eps-miss-')), 'nope');
    expect(run(missing).status).toBe(1);
    expect(existsSync(missing)).toBe(false);
  }, SLOW);
});
