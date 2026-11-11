import { describe, expect, it } from 'vitest';
import { countFallbacks, countUncostedAttempts, summaryLine, totalCostUsd } from '../../src/log/summary.js';
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

describe('cost helpers', () => {
  it('ignore costs that are not finite non-negative numbers', async () => {
    const log = await playMock(1);
    const attempts = log.turns.flatMap((t) => t.attempts);
    expect(totalCostUsd(log)).toBeNull();
    expect(countUncostedAttempts(log)).toBe(attempts.length);
    const bad = [Number.NaN, -1, Number.POSITIVE_INFINITY];
    attempts.forEach((a, i) => { a.usage = { costUsd: bad[i % 3] as number }; });
    expect(totalCostUsd(log)).toBeNull();
    expect(countUncostedAttempts(log)).toBe(attempts.length);
    attempts[0]!.usage = { costUsd: 0.5 };
    attempts[1]!.usage = { costUsd: 0.25 };
    expect(totalCostUsd(log)).toBe(0.75);
    expect(countUncostedAttempts(log)).toBe(attempts.length - 2);
  });
});
