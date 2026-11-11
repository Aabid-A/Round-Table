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
