import { describe, expect, it } from 'vitest';
import { buildContext } from '../../src/log/highlights/context.js';
import { faithfulBannishedByMajority, finalReveal, recruitAccepted } from '../../src/log/highlights/rules.js';
import { logFrom, type Spec } from '../helpers/logs.js';

const roles = { T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful', F3: 'faithful', F4: 'faithful' } as const;

describe('recruitAccepted', () => {
  const accepted = logFrom({ ...roles }, [
    { r: 1, phase: 'vote', p: 'F1', action: { target: 'T2' } },
    { r: 1, ev: { type: 'banishment', player: 'T2', role: 'traitor', method: 'majority' } },
    { r: 1, phase: 'recruit_choose', p: 'T1', action: { target: 'F3' } },
    { r: 1, phase: 'recruit_respond', p: 'F3', action: { accept: true }, speech: '', notes: 'Join them, then play both sides.' },
    { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F3', accepted: true } },
  ]);

  it('finds an accepted offer, from the offer to the answer, with the answer as the faces turn', () => {
    expect(recruitAccepted(buildContext(accepted))).toEqual([
      { rule: 'recruit_accepted', score: 90, title: "F3 accepts T1's offer and becomes a traitor", from: 1, to: 2, facesTurn: 2, round: 1 },
    ]);
  });

  it('ignores a refusal and a game with no offer', () => {
    const refused = logFrom({ ...roles }, [
      { r: 1, phase: 'recruit_choose', p: 'T1', action: { target: 'F3' } },
      { r: 1, phase: 'recruit_respond', p: 'F3', action: { accept: false } },
      { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F3', accepted: false } },
    ]);
    expect(recruitAccepted(buildContext(refused))).toEqual([]);
    expect(recruitAccepted(buildContext(logFrom({ ...roles }, [])))).toEqual([]);
  });
});

describe('faithfulBannishedByMajority', () => {
  const votes = [
    { voter: 'T1', target: 'F1' },
    { voter: 'T2', target: 'F1' },
    { voter: 'F2', target: 'F1' },
    { voter: 'F3', target: 'T1' },
  ];
  const specs = (role: 'faithful' | 'traitor', method: 'majority' | 'revote', who = 'F1'): Spec[] =>
    [
      ...votes.map((v) => ({ r: 2, phase: 'vote' as const, p: v.voter, action: { target: v.target } })),
      { r: 2, ev: { type: 'vote', stage: 'vote', votes, tally: { F1: 3, T1: 1 }, leaders: ['F1'] } },
      { r: 2, ev: { type: 'banishment', player: who, role, method } },
    ];

  it('finds a faithful banished by a majority and scores it by the share of votes', () => {
    const [h] = faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, specs('faithful', 'majority'))));
    expect(h).toMatchObject({ rule: 'faithful_banished_by_majority', from: 0, to: 3, round: 2, facesTurn: null });
    expect(h!.score).toBe(Math.round(55 + 0.75 * 30));
    expect(h!.title).toBe('F1, a faithful, is banished by a majority (3 of 4 votes)');
  });

  it('ignores a traitor, and a faithful decided by a revote', () => {
    expect(faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, specs('traitor', 'majority', 'T1'))))).toEqual([]);
    expect(faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, specs('faithful', 'revote'))))).toEqual([]);
  });
});

describe('finalReveal', () => {
  it('covers the last turns and names the winner', () => {
    const log = logFrom(
      { ...roles },
      Array.from({ length: 6 }, (_, i) => ({ r: 3, phase: 'vote' as const, p: 'F1', action: { target: `T${(i % 2) + 1}` } })),
      { winner: 'faithful', reason: 'no_traitors', rounds: 3 },
    );
    expect(finalReveal(buildContext(log))).toEqual([
      { rule: 'final_reveal', score: 50, title: 'The final reveal: the faithfuls win (no traitors)', from: 3, to: 5, facesTurn: null, round: 3 },
    ]);
  });

  it('handles a short game and a stopped game', () => {
    expect(finalReveal(buildContext(logFrom({ ...roles }, [])))).toEqual([]);
    const one = logFrom({ ...roles }, [{ r: 1, phase: 'vote', p: 'F1', action: { target: 'T1' } }], { winner: null, reason: 'cost_cap' });
    expect(finalReveal(buildContext(one))[0]).toMatchObject({ from: 0, to: 0, title: 'The final reveal: no winner (cost cap)' });
  });
});
