import { describe, expect, it } from 'vitest';
import { buildGuessSteps } from '../../web/src/guess/steps.js';
import { buildSteps } from '../../web/src/replay/timeline.js';
import { playMock } from '../helpers/game.js';

describe('buildGuessSteps', () => {
  it('keeps only what every player could see, and never the traitors night, whispers, recruitment or the result', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const log = await playMock(seed);
      for (const g of buildGuessSteps(log)) {
        if (g.kind !== 'play') continue;
        if (g.step.kind === 'turn') expect(['round_table', 'vote', 'revote', 'endgame_vote']).toContain(g.step.turn.phase);
        if (g.step.kind === 'event') expect(['breakfast', 'vote', 'banishment', 'endgame_vote']).toContain(g.step.event.type);
        expect(g.step.kind).not.toBe('result');
      }
    }
  });

  it('puts one pick step after each round table and before that round\'s first vote, and ends on the score', async () => {
    const log = await playMock(1);
    const steps = buildGuessSteps(log);
    const picks = steps.filter((s) => s.kind === 'pick');
    const rounds = [...new Set(log.turns.filter((t) => t.phase === 'vote').map((t) => t.round))];
    expect(picks.map((p) => p.kind === 'pick' && p.round)).toEqual(rounds);
    steps.forEach((s, i) => {
      if (s.kind !== 'pick') return;
      const before = steps[i - 1];
      const after = steps[i + 1];
      expect(before?.kind === 'play' && before.step.kind === 'turn' && before.step.turn.phase).toBe('round_table');
      expect(after?.kind === 'play' && after.step.kind === 'turn' && after.step.turn.phase).toBe('vote');
    });
    expect(steps.at(-1)?.kind).toBe('score');
    expect(steps.filter((s) => s.kind === 'score')).toHaveLength(1);
  });

  it('points each step at a valid place in the full replay, in order', async () => {
    const log = await playMock(2);
    const total = buildSteps(log).length;
    let prev = -1;
    for (const s of buildGuessSteps(log)) {
      expect(s.at).toBeGreaterThanOrEqual(0);
      expect(s.at).toBeLessThan(total);
      expect(s.at).toBeGreaterThanOrEqual(prev);
      prev = s.at;
    }
  });

  it('has no pick when a game never reaches a vote', async () => {
    const log = await playMock(1);
    const noVotes = { ...log, turns: log.turns.filter((t) => t.round === 1 && (t.phase === 'night' || t.phase === 'round_table')), events: [] };
    expect(buildGuessSteps(noVotes).some((s) => s.kind === 'pick')).toBe(false);
  });
});
