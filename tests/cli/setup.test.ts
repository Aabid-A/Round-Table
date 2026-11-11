import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBatch } from '../../src/cli/batch.js';
import { parseMaxCost, playGame, prepareSetup, type Setup } from '../../src/cli/setup.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import type { Player } from '../../src/players/player.js';

const opts = { mock: true, cast: undefined, config: 'config/game.json', timeoutMs: undefined } as const;

/** Mock players that report a cost on every call. */
const costlySetup = (maxCostUsd: string): Setup => {
  const setup = prepareSetup({ ...opts, maxCostUsd });
  return {
    ...setup,
    makePlayers: (seed) =>
      Object.fromEntries(
        Object.entries(createMockPlayers(MOCK_CAST, seed)).map(([name, p]) => [
          name,
          { respond: async (r) => ({ text: (await p.respond(r)) as string, usage: { costUsd: 0.5 } }) } satisfies Player,
        ]),
      ),
  };
};

describe('--max-cost-usd', () => {
  it('parses a positive number and rejects the rest', () => {
    expect(parseMaxCost(undefined)).toBeUndefined();
    expect(parseMaxCost('2.5')).toBe(2.5);
    for (const bad of ['0', '-1', 'abc', '', 'NaN', 'Infinity']) {
      expect(() => parseMaxCost(bad), bad).toThrow('--max-cost-usd must be a positive number');
    }
  });

  it('is carried by the setup and rejected early when invalid', () => {
    expect(prepareSetup({ ...opts, maxCostUsd: '3' }).maxCostUsd).toBe(3);
    expect(prepareSetup(opts).maxCostUsd).toBeUndefined();
    expect(() => prepareSetup({ ...opts, maxCostUsd: '0' })).toThrow('positive number');
  });

  it('stops a game that reports costs once the cap would be passed', async () => {
    const log = await playGame(costlySetup('2'), 1);
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null, costCap: { maxUsd: 2, spentUsd: 2 } });
    expect(log.turns.flatMap((t) => t.attempts)).toHaveLength(4);
  });

  it('applies to every game in a batch', async () => {
    const lines: string[] = [];
    const result = await runBatch(costlySetup('1'), [1, 2], mkdtempSync(join(tmpdir(), 'rt-cap-')), (l) => lines.push(l));
    expect(result.sawCost).toBe(true);
    expect(lines.every((l) => l.includes('no winner | cost_cap'))).toBe(true);
  });

  it('counts attempts that reported no cost', async () => {
    const result = await runBatch(costlySetup('1000'), [1], mkdtempSync(join(tmpdir(), 'rt-cap-')), () => {});
    expect(result.uncostedAttempts).toBe(0);
    const none = await runBatch(prepareSetup({ ...opts, maxCostUsd: '1' }), [1], mkdtempSync(join(tmpdir(), 'rt-cap-')), () => {});
    expect(none.uncostedAttempts).toBeGreaterThan(20);
  });

  it('reports sawCost false when players report no cost', async () => {
    const result = await runBatch(prepareSetup({ ...opts, maxCostUsd: '1' }), [1], mkdtempSync(join(tmpdir(), 'rt-cap-')), () => {});
    expect(result.sawCost).toBe(false);
  });
});
