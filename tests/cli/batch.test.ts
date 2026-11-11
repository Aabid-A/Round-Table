import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBatch } from '../../src/cli/batch.js';
import { parseSeeds } from '../../src/cli/seeds.js';
import { prepareSetup, type Setup } from '../../src/cli/setup.js';
import { readGameLog } from '../../src/log/writer.js';

const mockSetup = (): Setup => prepareSetup({ mock: true, cast: undefined, config: 'config/game.json', timeoutMs: undefined });

describe('runBatch', () => {
  it('plays every seed, writes a log for each and prints one line per game', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-batch-'));
    const printed: string[] = [];
    const seeds = parseSeeds('1-5');
    const result = await runBatch(mockSetup(), seeds, dir, (l) => printed.push(l));
    expect(result.failed).toBe(0);
    expect(printed).toHaveLength(5);
    expect(printed).toEqual(result.lines);
    expect(readdirSync(dir).sort()).toEqual(seeds.map((s) => `mock-seed-${s}.json`));
    for (const [i, line] of printed.entries()) {
      expect(line).toMatch(new RegExp(`^seed ${seeds[i]} \\| (traitor|faithful) wins \\| \\w+ \\| rounds \\d+ \\| fallbacks \\d+ \\| .*mock-seed-${seeds[i]}\\.json$`));
      expect(readGameLog(line.split(' | ').pop() as string).seed).toBe(seeds[i]);
    }
  });

  it('fails before the first game when the output folder is unusable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rt-batch-'));
    const file = join(dir, 'not-a-folder');
    writeFileSync(file, 'x');
    let played = 0;
    const setup = mockSetup();
    const counting: Setup = { ...setup, makePlayers: (seed) => { played++; return setup.makePlayers(seed); } };
    await expect(runBatch(counting, [1, 2], join(file, 'games'), () => {})).rejects.toThrow();
    expect(played).toBe(0);
  });

  it('reports a game that throws and keeps going', async () => {
    const setup = mockSetup();
    const broken: Setup = {
      ...setup,
      makePlayers: (seed) => {
        if (seed === 2) throw new Error('boom');
        return setup.makePlayers(seed);
      },
    };
    const lines: string[] = [];
    const result = await runBatch(broken, [1, 2, 3], mkdtempSync(join(tmpdir(), 'rt-batch-')), (l) => lines.push(l));
    expect(result.failed).toBe(1);
    expect(lines[1]).toBe('seed 2 | error: boom');
    expect(lines[0]).toContain('seed 1 |');
    expect(lines[2]).toContain('seed 3 |');
  });
});
