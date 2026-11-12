import { describe, expect, it } from 'vitest';
import { runGame } from '../../src/engine/game.js';
import { maxModelCalls } from '../../src/engine/limits.js';
import { DEFAULT_SETTINGS, type GameLog, type GameSettings } from '../../src/engine/types.js';
import { renderTranscript } from '../../src/log/transcript.js';
import { createMockPlayer, createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import type { Player } from '../../src/players/player.js';
import { createReplayPlayers } from '../../src/players/replay.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';

const play = (players: Record<string, Player>, extra: { maxModelCalls?: number; maxCostUsd?: number } = {}, seed = 1, settings: GameSettings = DEFAULT_SETTINGS, cast = MOCK_CAST) =>
  runGame({ cast, settings, seed, players, buildPrompt, systemPrompt: SYSTEM_PROMPT, ...extra });

const callsIn = (log: GameLog): number => log.turns.reduce((n, t) => n + t.attempts.length, 0);

describe('maxModelCalls', () => {
  it('is worked out from the seats and the rounds: seven turns a seat a round, two for a recruitment, two calls a turn', () => {
    expect(maxModelCalls({ maxRounds: 6, traitors: 2 }, 8)).toBe(696); // (7 x 8 + 2) x 2 x 6
    expect(maxModelCalls({ maxRounds: 1, traitors: 1 }, 4)).toBe(60); // (7 x 4 + 2) x 2 x 1
    expect(maxModelCalls({ maxRounds: 3, traitors: 2 }, 8)).toBe(maxModelCalls({ maxRounds: 6, traitors: 2 }, 8) / 2);
  });

  it('is never reached by a game that goes wrong in the ways a game can: every reply invalid (two calls on every turn), over many seeds and settings', async () => {
    const cases: [GameSettings, typeof MOCK_CAST][] = [
      [DEFAULT_SETTINGS, MOCK_CAST],
      [{ maxRounds: 6, traitors: 3 }, MOCK_CAST],
      [{ maxRounds: 4, traitors: 1 }, MOCK_CAST.slice(0, 6)],
      [{ maxRounds: 2, traitors: 2 }, MOCK_CAST.slice(0, 5)],
    ];
    let worst = 0;
    for (const [settings, cast] of cases) {
      const limit = maxModelCalls(settings, cast.length);
      for (let seed = 1; seed <= 25; seed++) {
        for (const mode of ['valid', 'broken'] as const) {
          const players = Object.fromEntries(cast.map((c) => [c.name, createMockPlayer({ seed, name: c.name, mode })]));
          const log = await play(players, {}, seed, settings, cast);
          expect(log.result.reason, `${mode} seed ${seed}`).not.toBe('call_limit');
          worst = Math.max(worst, callsIn(log) / limit);
        }
      }
    }
    expect(worst).toBeLessThan(1); // never reached; this is how close the closest game came
  });
});

describe('the hard stop on calls', () => {
  it('stops before the call that would pass the limit, and records it', async () => {
    const log = await play(createMockPlayers(MOCK_CAST, 1), { maxModelCalls: 10 });
    expect(callsIn(log)).toBe(10);
    expect(log.result).toMatchObject({ reason: 'call_limit', winner: null, callLimit: { maxCalls: 10, calls: 10 } });
    expect('costCap' in log.result).toBe(false);
  });

  it('settles a turn with its fallback when the limit lands before its retry, then stops', async () => {
    const players = Object.fromEntries(MOCK_CAST.map((c) => [c.name, { respond: async () => 'not json' } satisfies Player]));
    const log = await play(players, { maxModelCalls: 3 });
    // Turn 1 takes two calls (the reply and the retry), turn 2 takes the third and its retry is blocked.
    expect(log.turns.map((t) => t.attempts.length)).toEqual([2, 1]);
    expect(log.turns.map((t) => t.fallback)).toEqual([true, true]);
    expect(log.result).toMatchObject({ reason: 'call_limit', callLimit: { maxCalls: 3, calls: 3 } });
  });

  it('does not depend on cost: free calls, cheap calls and no cap at all are all stopped', async () => {
    const cheap = Object.fromEntries(
      Object.entries(createMockPlayers(MOCK_CAST, 1)).map(([name, p]) => [name, { metered: true, respond: async (r) => ({ text: (await p.respond(r)) as string, usage: { costUsd: 0.000001 } }) } satisfies Player]),
    );
    const log = await play(cheap, { maxModelCalls: 25, maxCostUsd: 1000 }); // a huge cap that is never near
    expect(callsIn(log)).toBe(25);
    expect(log.result.reason).toBe('call_limit');
  });

  it('a spend cap that is reached first still wins, and the call limit does not appear', async () => {
    const costly = Object.fromEntries(
      Object.entries(createMockPlayers(MOCK_CAST, 1)).map(([name, p]) => [name, { metered: true, respond: async (r) => ({ text: (await p.respond(r)) as string, usage: { costUsd: 0.5 } }) } satisfies Player]),
    );
    const log = await play(costly, { maxModelCalls: 100, maxCostUsd: 1 });
    expect(log.result.reason).toBe('cost_cap');
    expect('callLimit' in log.result).toBe(false);
  });

  it('refuses a limit that is not a positive whole number', async () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(play(createMockPlayers(MOCK_CAST, 1), { maxModelCalls: bad }), String(bad)).rejects.toThrow('maxModelCalls must be a positive whole number');
    }
  });

  it('replays a game stopped by the limit identically, given the same limit', async () => {
    const original = await play(createMockPlayers(MOCK_CAST, 2), { maxModelCalls: 40 }, 2);
    expect(original.result.reason).toBe('call_limit');
    expect(await play(createReplayPlayers(original), { maxModelCalls: 40 }, 2)).toEqual(original);
  });

  it('shows in the transcript', async () => {
    const log = await play(createMockPlayers(MOCK_CAST, 1), { maxModelCalls: 10 });
    expect(renderTranscript(log)).toContain('Stopped early: the game reached its limit of 10 calls to players.');
    expect(renderTranscript(log)).toContain('No winner (call limit');
  });
});
