import { describe, expect, it } from 'vitest';
import { countFallbacks, summaryLine } from '../../src/log/summary.js';
import { createMockPlayer, createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { play, playMock } from '../helpers/game.js';

describe('summaryLine', () => {
  it('shows seed, winner, reason, rounds and fallbacks on one line', async () => {
    const log = await playMock(1);
    const line = summaryLine(log);
    expect(line).toBe(`seed 1 | ${log.result.winner} wins | ${log.result.reason} | rounds ${log.result.rounds} | fallbacks 0`);
    expect(line).not.toContain('\n');
  });

  it('counts fallback turns', async () => {
    const players = createMockPlayers(MOCK_CAST, 3);
    players.Dax = createMockPlayer({ seed: 3, name: 'Dax', mode: 'broken' });
    const log = await play(players, 3);
    const n = log.turns.filter((t) => t.player === 'Dax').length;
    expect(n).toBeGreaterThan(0);
    expect(countFallbacks(log)).toBe(n);
    expect(summaryLine(log)).toContain(`fallbacks ${n}`);
  });
});
