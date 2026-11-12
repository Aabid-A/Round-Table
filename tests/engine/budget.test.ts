import { describe, expect, it } from 'vitest';
import { runGame } from '../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { createReplayPlayers } from '../../src/players/replay.js';
import type { Player } from '../../src/players/player.js';
import { renderTranscript } from '../../src/log/transcript.js';
import { summaryLine } from '../../src/log/summary.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';

/** Mock players where every call reports a cost from `cost(callIndex)`. */
function costed(seed: number, cost: (call: number) => number, mutate?: (text: string, call: number) => string): Record<string, Player> {
  const base = createMockPlayers(MOCK_CAST, seed);
  let call = 0;
  return Object.fromEntries(
    Object.entries(base).map(([name, p]) => [
      name,
      {
        async respond(req) {
          const text = (await p.respond(req)) as string;
          const n = call++;
          return { text: mutate ? mutate(text, n) : text, usage: { costUsd: cost(n) } };
        },
      } satisfies Player,
    ]),
  );
}

const run = (players: Record<string, Player>, maxCostUsd?: number, seed = 1) =>
  runGame({
    cast: MOCK_CAST,
    settings: DEFAULT_SETTINGS,
    seed,
    players,
    buildPrompt,
    systemPrompt: SYSTEM_PROMPT,
    ...(maxCostUsd !== undefined ? { maxCostUsd } : {}),
  });

describe('cost cap', () => {
  it('stops before the call that would pass the cap and records why', async () => {
    const log = await run(costed(1, () => 0.25), 1);
    const attempts = log.turns.flatMap((t) => t.attempts);
    expect(attempts).toHaveLength(4);
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null, costCap: { maxUsd: 1, spentUsd: 1 } });
    expect(log.turns.every((t) => !t.fallback)).toBe(true);
  });

  it('plays to the end when the cap is never reached, with no costCap on the result', async () => {
    const log = await run(costed(1, () => 0.001), 1000);
    expect(log.result.reason).not.toBe('cost_cap');
    expect(log.result.winner).not.toBeNull();
    expect('costCap' in log.result).toBe(false);
  });

  it('plans for the dearest call so far, not the average', async () => {
    // Costs 0.1, 0.4, then 0.1 forever. Cap 1.0: after two calls spent 0.5, dearest 0.4.
    const log = await run(costed(1, (n) => (n === 1 ? 0.4 : 0.1)), 1);
    const total = log.turns.flatMap((t) => t.attempts).reduce((sum, a) => sum + (a.usage?.costUsd ?? 0), 0);
    expect(log.result.reason).toBe('cost_cap');
    expect(total).toBeLessThanOrEqual(1 + 1e-9);
    expect(log.result.costCap?.spentUsd).toBeCloseTo(total, 9);
  });

  it('settles a turn with its fallback when the cap blocks the retry, then stops', async () => {
    // First call is invalid and costs 0.6; the retry could pass the 1.0 cap.
    const log = await run(costed(1, () => 0.6, (text, n) => (n === 0 ? 'not json' : text)), 1);
    const first = log.turns[0]!;
    expect(first.fallback).toBe(true);
    expect(first.attempts).toHaveLength(1);
    expect(first.attempts[0]?.error).toBe('reply is not valid JSON');
    expect(log.turns).toHaveLength(1);
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null });
  });

  it('is not thrown off by float noise in the totals', async () => {
    // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in floats, but three calls fit under a 0.3 cap.
    const log = await run(costed(1, () => 0.1), 0.3);
    expect(log.turns.flatMap((t) => t.attempts)).toHaveLength(3);
    expect(log.result.costCap).toEqual({ maxUsd: 0.3, spentUsd: 0.3 });
  });

  it('ignores costs that are not finite non-negative numbers', async () => {
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const log = await run(costed(1, (n) => (n % 2 === 0 ? bad : 0.25)), 1);
      const attempts = log.turns.flatMap((t) => t.attempts);
      expect(log.result.reason, String(bad)).toBe('cost_cap');
      // Only the 0.25 calls count, so exactly four of them were paid for.
      expect(attempts.filter((a) => a.usage?.costUsd === 0.25), String(bad)).toHaveLength(4);
      expect(log.result.costCap?.spentUsd).toBe(1);
    }
  });

  it('counts a call with no reported cost as free, and stays capped on the costed ones', async () => {
    const base = createMockPlayers(MOCK_CAST, 1);
    let n = 0;
    const players = Object.fromEntries(Object.entries(base).map(([name, p]) => [name, {
      respond: async (r) => {
        const text = (await p.respond(r)) as string;
        return n++ % 2 === 0 ? { text, usage: { costUsd: 0.5 } } : { text };
      },
    } satisfies Player]));
    const log = await run(players, 1);
    expect(log.result.reason).toBe('cost_cap');
    expect(log.result.costCap?.spentUsd).toBe(1);
    // Calls 0 (0.5), 1 (free), 2 (0.5); the check before call 3 sees 1 + 0.5 > 1.
    expect(log.turns.flatMap((t) => t.attempts)).toHaveLength(3);
  });

  it('can overshoot on the first call or on a call dearer than any before it', async () => {
    // Documented limit: the check predicts from calls already seen.
    const first = await run(costed(1, () => 5), 1);
    expect(first.turns.flatMap((t) => t.attempts)).toHaveLength(1);
    expect(first.result.costCap).toEqual({ maxUsd: 1, spentUsd: 5 });
    const spike = await run(costed(1, (n) => (n < 3 ? 1 : 10)), 5);
    expect(spike.result.costCap?.spentUsd).toBe(13);
  });

  it('replays a capped game identically', async () => {
    const original = await run(costed(2, () => 0.25), 2, 2);
    const replayed = await run(createReplayPlayers(original), 2, 2);
    expect(replayed).toEqual(original);
  });

  it('does nothing for players that report no cost', async () => {
    const log = await run(createMockPlayers(MOCK_CAST, 1), 0.01);
    expect(log.result.reason).not.toBe('cost_cap');
  });

  it('rejects a cap that is not a positive number', async () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(run(createMockPlayers(MOCK_CAST, 1), bad)).rejects.toThrow('maxCostUsd');
    }
  });

  it('shows in the transcript and the summary line', async () => {
    const log = await run(costed(1, () => 0.25), 1);
    expect(renderTranscript(log)).toContain('No winner (cost cap');
    expect(renderTranscript(log)).toContain('Stopped early');
    expect(summaryLine(log)).toContain('no winner | cost_cap');
  });
});

/** What a real-model player does on one call: report a cost, report none, report a bad number, or fail (a timeout or an HTTP error). */
type Behaviour = { kind: 'cost'; usd: number } | { kind: 'none' } | { kind: 'bad'; value: number } | { kind: 'fail'; message: string };

/** Mock players that declare themselves metered (real models), behaving as `behave(callIndex)` says. */
function meteredPlayers(seed: number, behave: (call: number) => Behaviour): Record<string, Player> {
  const base = createMockPlayers(MOCK_CAST, seed);
  let call = 0;
  return Object.fromEntries(
    Object.entries(base).map(([name, p]) => [
      name,
      {
        metered: true,
        async respond(req) {
          const b = behave(call++);
          if (b.kind === 'fail') throw new Error(b.message);
          const text = (await p.respond(req)) as string;
          if (b.kind === 'cost') return { text, usage: { costUsd: b.usd } };
          if (b.kind === 'bad') return { text, usage: { costUsd: b.value } };
          return { text };
        },
      } satisfies Player,
    ]),
  );
}

const attemptsOf = (log: Awaited<ReturnType<typeof run>>) => log.turns.flatMap((t) => t.attempts);
const runWithFloor = (players: Record<string, Player>, maxCostUsd: number, costFloorUsd?: number) =>
  runGame({
    cast: MOCK_CAST,
    settings: DEFAULT_SETTINGS,
    seed: 1,
    players,
    buildPrompt,
    systemPrompt: SYSTEM_PROMPT,
    maxCostUsd,
    ...(costFloorUsd !== undefined ? { costFloorUsd } : {}),
  });

describe('cost cap: a real-model call with no usable cost counts as an estimate', () => {
  it('counts the floor (0.01) for each call while no real cost has been seen, so the cap still stops the game, and logs the estimate', async () => {
    const log = await run(meteredPlayers(1, () => ({ kind: 'none' })), 0.05);
    const attempts = attemptsOf(log);
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null, costCap: { maxUsd: 0.05, spentUsd: 0.05 } });
    expect(attempts).toHaveLength(5);
    for (const a of attempts) expect(a.costEstimatedUsd).toBe(0.01);
  });

  it('uses a floor you set', async () => {
    const log = await runWithFloor(meteredPlayers(1, () => ({ kind: 'none' })), 0.5, 0.1);
    expect(attemptsOf(log)).toHaveLength(5);
    expect(attemptsOf(log).every((a) => a.costEstimatedUsd === 0.1)).toBe(true);
    expect(log.result.costCap?.spentUsd).toBe(0.5);
  });

  it('counts the largest cost seen so far once there is one, not the floor and not the latest', async () => {
    // Costs 0.1, then 0.4, then nothing is ever reported: from then on each call counts 0.4.
    const log = await run(meteredPlayers(1, (n) => (n === 0 ? { kind: 'cost', usd: 0.1 } : n === 1 ? { kind: 'cost', usd: 0.4 } : { kind: 'none' })), 2);
    const attempts = attemptsOf(log);
    expect(attempts[0]?.costEstimatedUsd).toBeUndefined(); // a real cost is not marked
    expect(attempts[1]?.costEstimatedUsd).toBeUndefined();
    for (const a of attempts.slice(2)) expect(a.costEstimatedUsd).toBe(0.4);
    // 0.1 + 0.4, then 0.4 each: the check before a call stops when spend plus 0.4 would pass 2.
    expect(log.result.costCap?.spentUsd).toBeLessThanOrEqual(2 + 1e-9);
    expect(log.result.costCap?.spentUsd).toBeGreaterThan(1.5);
    expect(log.result.reason).toBe('cost_cap');
  });

  it('counts failed and timed-out calls the same way, and the game goes on with fallbacks until the cap', async () => {
    const log = await run(meteredPlayers(1, () => ({ kind: 'fail', message: 'request timed out after 60000ms' })), 0.04);
    const attempts = attemptsOf(log);
    expect(log.result.reason).toBe('cost_cap');
    expect(attempts).toHaveLength(4);
    for (const a of attempts) {
      expect(a.error).toBe('request timed out after 60000ms');
      expect(a.costEstimatedUsd).toBe(0.01);
    }
    expect(log.turns.some((t) => t.fallback)).toBe(true); // a turn whose calls both failed uses its fallback
  });

  it('treats a cost that is not a finite non-negative number as no cost', async () => {
    for (const value of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const log = await run(meteredPlayers(1, () => ({ kind: 'bad', value })), 0.03);
      expect(attemptsOf(log).every((a) => a.costEstimatedUsd === 0.01), String(value)).toBe(true);
      expect(log.result.costCap?.spentUsd, String(value)).toBe(0.03);
    }
  });

  it('does not count a free player (mock or human): no estimate, and the game plays to the end under a cap', async () => {
    const log = await run(createMockPlayers(MOCK_CAST, 1), 0.01);
    expect(log.result.reason).not.toBe('cost_cap');
    expect(attemptsOf(log).some((a) => a.costEstimatedUsd !== undefined)).toBe(false);
  });

  it('records no estimate when there is no cap', async () => {
    const log = await run(meteredPlayers(1, () => ({ kind: 'none' })));
    expect(log.result.reason).not.toBe('cost_cap');
    expect(attemptsOf(log).some((a) => a.costEstimatedUsd !== undefined)).toBe(false);
  });

  it('refuses a floor that is not a positive number', async () => {
    for (const bad of [0, -0.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(runWithFloor(createMockPlayers(MOCK_CAST, 1), 1, bad), String(bad)).rejects.toThrow('costFloorUsd must be a positive number');
    }
  });
});
