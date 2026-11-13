import { describe, expect, it } from 'vitest';
import { runGame } from '../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';
import { banished, dawnVictim, scriptFromLog, SLICE_SEED, type SliceScript } from '../../web/src/slice/script.js';

const play = (seed: number) => runGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed, players: createMockPlayers(MOCK_CAST, seed), buildPrompt, systemPrompt: SYSTEM_PROMPT });
let script: SliceScript;

describe('the slice script', () => {
  it('is built from the fixed mock game: eight seats, the player a faithful at seat 0, two traitors among the seven AIs', async () => {
    script = scriptFromLog(await play(SLICE_SEED));
    expect(script.players).toHaveLength(8);
    expect(script.players[0]).toEqual({ index: 0, name: 'You', role: 'faithful' });
    expect(script.players.filter((p) => p.role === 'traitor')).toHaveLength(2);
    expect(new Set(script.players.map((p) => p.name)).size).toBe(8);
    expect(script.players.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('has seven speeches, one per AI, each with words and someone else to point at', () => {
    expect(script.speeches).toHaveLength(7);
    expect(new Set(script.speeches.map((s) => s.speaker))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    for (const s of script.speeches) {
      expect(s.text.length).toBeGreaterThan(10);
      expect(s.suspect).not.toBe(s.speaker);
      expect(s.suspect).toBeGreaterThanOrEqual(1);
    }
    expect(script.yourTurnAfter).toBeGreaterThan(0);
    expect(script.yourTurnAfter).toBeLessThan(7);
  });

  it('is the same every time: the same game gives the same script', async () => {
    expect(scriptFromLog(await play(SLICE_SEED))).toEqual(script);
  });

  it('banishes the most voted seat, breaks a tie toward the log’s own banishment, and counts the player’s token', () => {
    const base: SliceScript = { ...script, aiVotes: { 1: 3, 2: 3, 3: 4, 4: 3, 5: 6, 6: 6, 7: 4 }, logBanished: 6 };
    expect(banished(base, 3).seat).toBe(3); // 4 votes for 3
    expect(banished(base, 6).tally[6]).toBe(3); // 2 + yours
    // Three seats tied at two votes each (with the player's): the log's own banishment wins if it is among them, else the lowest seat.
    const tie = { ...base, aiVotes: { 1: 3, 2: 3, 3: 6, 4: 6, 5: 1, 6: 2, 7: 4 } };
    expect(banished({ ...tie, logBanished: 6 }, 1).seat).toBe(6);
    expect(banished({ ...tie, logBanished: 7 }, 1).seat).toBe(1);
    // Whatever the player does, someone is banished, and it is never a seat that does not exist.
    for (let v = 0; v < 8; v++) expect(banished(script, v).seat).toBeLessThan(8);
  });

  it('finds someone at the table at dawn, never the player and never the banished', () => {
    for (let b = 0; b < 8; b++) {
      const v = dawnVictim(script, b);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(7);
      expect(v).not.toBe(b);
    }
  });
});
