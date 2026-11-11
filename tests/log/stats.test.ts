import { describe, expect, it } from 'vitest';
import { computeStats } from '../../src/log/stats.js';
import { logFrom } from '../helpers/logs.js';
import { game1, game2 } from '../helpers/season.js';
import { playMock } from '../helpers/game.js';

describe('computeStats', () => {
  const stats = computeStats([game1(), game2()]);
  const by = (m: string) => stats.models.find((x) => x.model === m)!;

  it('counts games and which games had a winner', () => {
    expect(stats).toMatchObject({ statsVersion: 1, games: 2, decidedGames: 2 });
    expect(by('model-a').games).toBe(2);
    expect(by('model-c').games).toBe(3); // two seats in game 1, one in game 2
  });

  it('counts games and wins by role, with a recruit finishing as a traitor', () => {
    expect(by('model-a')).toMatchObject({ asTraitor: { games: 2, wins: 1 }, asFaithful: { games: 0, wins: 0 } });
    expect(by('model-b')).toMatchObject({ asTraitor: { games: 1, wins: 1 } });
    // model-c: F1 (faithful, lost) and F2 (recruited, so a traitor, won) in game 1; F1 (faithful, won) in game 2
    expect(by('model-c')).toMatchObject({ asTraitor: { games: 1, wins: 1 }, asFaithful: { games: 2, wins: 1 } });
    expect(by('model-d')).toMatchObject({ asFaithful: { games: 2, wins: 1 } });
  });

  it('counts how often a traitor model was caught', () => {
    expect(by('model-a').caughtAsTraitor).toBe(1);
    expect(by('model-b').caughtAsTraitor).toBe(1);
    expect(by('model-c').caughtAsTraitor).toBe(0);
  });

  it('counts faithfuls banished by a traitor model voting for them, not by faithful voters', () => {
    expect(by('model-a').faithfulsBanishedByTraitorVote).toBe(1);
    expect(by('model-b').faithfulsBanishedByTraitorVote).toBe(1);
    expect(by('model-d').faithfulsBanishedByTraitorVote).toBe(0); // F3 voted for F1 too, but is faithful
    expect(by('model-c').faithfulsBanishedByTraitorVote).toBe(0);
  });

  it('counts recruit offers received and accepted by the model that was offered', () => {
    expect(by('model-c')).toMatchObject({ recruitOffersReceived: 1, recruitOffersAccepted: 1 });
    expect(by('model-a')).toMatchObject({ recruitOffersReceived: 0, recruitOffersAccepted: 0 });
  });

  it('counts turns, fallback turns and the fallback rate', () => {
    expect(by('model-d')).toMatchObject({ turns: 1, fallbackTurns: 1, fallbackRate: 1 });
    expect(by('model-a')).toMatchObject({ fallbackTurns: 0, fallbackRate: 0 });
    expect(by('model-c').turns).toBe(3);
  });

  it('scores the betrayal index and sorts best first', () => {
    // model-a: (1 win as traitor + 1 faithful banished + 0 accepted) / 2 games
    expect(by('model-a').betrayalIndex).toBe(1);
    // model-c: (1 win as traitor + 0 + 1 accepted) / 3 seats
    expect(by('model-c').betrayalIndex).toBe(0.67);
    expect(by('model-d').betrayalIndex).toBe(0);
    const order = stats.models.map((m) => m.betrayalIndex);
    expect(order).toEqual([...order].sort((a, b) => b - a));
    // model-b: (1 win as traitor + 1 faithful banished) / 1 game = 2, the best
    expect(by('model-b').betrayalIndex).toBe(2);
    expect(stats.models.map((m) => m.model)).toEqual(['model-b', 'model-a', 'model-c', 'model-d']);
  });

  it('leaves a game with no winner out of the role records but counts it as played', () => {
    const stopped = logFrom({ T1: 'traitor', F1: 'faithful' }, [], { winner: null, reason: 'cost_cap' }, { T1: 'model-a', F1: 'model-c' });
    const s = computeStats([stopped]);
    expect(s).toMatchObject({ games: 1, decidedGames: 0 });
    expect(s.models.find((m) => m.model === 'model-a')).toMatchObject({ games: 1, asTraitor: { games: 0, wins: 0 } });
  });

  it('is empty for no logs and deterministic for the same logs in any order', () => {
    expect(computeStats([])).toEqual({ statsVersion: 1, games: 0, decidedGames: 0, models: [] });
    expect(computeStats([game2(), game1()])).toEqual(stats);
  });

  it('works on real mock games and adds up: wins as traitor plus wins as faithful equals the seats on winning sides', async () => {
    const logs = await Promise.all([1, 2, 3, 4, 5].map((n) => playMock(n)));
    const s = computeStats(logs);
    expect(s.games).toBe(5);
    expect(s.models).toHaveLength(1); // every mock seat has the model "mock"
    const m = s.models[0]!;
    expect(m.games).toBe(40);
    expect(m.asTraitor.games + m.asFaithful.games).toBe(40);
    expect(m.turns).toBe(logs.reduce((n, l) => n + l.turns.length, 0));
  });
});
