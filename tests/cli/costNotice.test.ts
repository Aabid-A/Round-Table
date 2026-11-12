import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBatch } from '../../src/cli/batch.js';
import { costNotice } from '../../src/cli/costNotice.js';
import { parseCostFloor, playGame, prepareSetup, type Setup } from '../../src/cli/setup.js';
import { DEFAULT_SETTINGS } from '../../src/engine/types.js';
import { countEstimatedAttempts } from '../../src/log/summary.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import type { Player } from '../../src/players/player.js';

/** A setup whose players are metered (as real models are) and always fail, as a provider that is down would. */
const failingSetup = (extra: Partial<Setup>): Setup => ({
  cast: MOCK_CAST,
  settings: DEFAULT_SETTINGS,
  gameName: (seed) => `down-seed-${seed}`,
  makePlayers: () =>
    Object.fromEntries(MOCK_CAST.map((c) => [c.name, { metered: true, respond: async () => Promise.reject(new Error('request timed out after 60000ms')) } satisfies Player])),
  ...extra,
});

describe('--cost-floor-usd', () => {
  it('reads a positive number, and refuses anything else', () => {
    expect(parseCostFloor(undefined)).toBeUndefined();
    expect(parseCostFloor('0.02')).toBe(0.02);
    for (const bad of ['', ' ', '0', '-1', 'abc', 'NaN', 'Infinity']) expect(() => parseCostFloor(bad), bad).toThrow('--cost-floor-usd must be a positive number');
  });

  it('only means something with a cap', () => {
    const opts = { mock: true, cast: undefined, config: 'config/game.json', timeoutMs: undefined };
    expect(() => prepareSetup({ ...opts, costFloorUsd: '0.02' })).toThrow('only means something with --max-cost-usd');
    expect(prepareSetup({ ...opts, maxCostUsd: '1', costFloorUsd: '0.02' })).toMatchObject({ maxCostUsd: 1, costFloorUsd: 0.02 });
  });
});

describe('a capped run against a provider that fails', () => {
  it('stops at the cap, marks every call as an estimate, and the floor is the one you set', async () => {
    const log = await playGame(failingSetup({ maxCostUsd: 0.5, costFloorUsd: 0.1 }), 1);
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null });
    expect(countEstimatedAttempts(log)).toBe(5);
    expect(log.turns.flatMap((t) => t.attempts).every((a) => a.costEstimatedUsd === 0.1)).toBe(true);
  });

  it('uses the default floor of 0.01 without the flag', async () => {
    const log = await playGame(failingSetup({ maxCostUsd: 0.03 }), 1);
    expect(countEstimatedAttempts(log)).toBe(3);
  });

  it('counts the estimates across a batch, and the notice says so', async () => {
    const setup = failingSetup({ maxCostUsd: 0.02 });
    const result = await runBatch(setup, [1, 2], mkdtempSync(join(tmpdir(), 'rt-est-')), () => {});
    expect(result.estimatedAttempts).toBe(4);
    const [line] = costNotice({ capped: true, floorUsd: undefined, estimated: result.estimatedAttempts, sawCost: result.sawCost });
    expect(line).toContain('4 real-model calls came back with no cost');
    expect(line).toContain('0.01 dollars');
  });

  it('writes no estimates without a cap', async () => {
    const log = await playGame(failingSetup({}), 1);
    expect(countEstimatedAttempts(log)).toBe(0);
  });
});

describe('costNotice', () => {
  it('says nothing without a cap', () => {
    expect(costNotice({ capped: false, floorUsd: undefined, estimated: 9, sawCost: false })).toEqual([]);
  });

  it('explains the estimate: what it counted, the floor, how to change it, and where the log marks it', () => {
    const [line] = costNotice({ capped: true, floorUsd: 0.05, estimated: 1, sawCost: true });
    expect(line).toContain('1 real-model call came back with no cost');
    expect(line).toContain('largest cost seen so far in that game, or 0.05 dollars if none yet');
    expect(line).toContain('--cost-floor-usd');
    expect(line).toContain('costEstimatedUsd');
  });

  it('says a mock run has nothing to count, and is quiet when real costs were all reported', async () => {
    const mock = await playGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, gameName: () => 'm', makePlayers: (seed) => createMockPlayers(MOCK_CAST, seed), maxCostUsd: 1 }, 1);
    expect(costNotice({ capped: true, floorUsd: undefined, estimated: countEstimatedAttempts(mock), sawCost: false })).toEqual(['warning: no call cost anything, so --max-cost-usd had nothing to count (mock players are free).']);
    expect(costNotice({ capped: true, floorUsd: undefined, estimated: 0, sawCost: true })).toEqual([]);
  });
});
