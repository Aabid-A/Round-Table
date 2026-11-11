import { describe, expect, it } from 'vitest';
import { emojiRow, missedMoments, pickSetups, scoreGuesses, shareText } from '../../web/src/guess/score.js';
import { buildGuessSteps } from '../../web/src/guess/steps.js';
import { logFrom, type Spec } from '../helpers/logs.js';

const roles = { T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful', F3: 'faithful', F4: 'faithful' } as const;
const table = (r: number, players: string[]): Spec[] =>
  players.map((p) => ({ r, phase: 'round_table' as const, p, action: { suspect: 'F1', reason: 'x' }, speech: `${p} speaks`, notes: `${p} secretly plans` }));
const vote = (r: number, players: string[]): Spec[] => players.map((p) => ({ r, phase: 'vote' as const, p, action: { target: 'F1' } }));

/** Round 1: F4 murdered, F1 banished (a faithful). Round 2: T2 banished (a traitor). Round 3: F2 banished. */
const log = logFrom({ ...roles }, [
  { r: 1, ev: { type: 'breakfast', victim: 'F4', role: 'faithful' } },
  ...table(1, ['T1', 'T2', 'F1', 'F2', 'F3']),
  ...vote(1, ['T1', 'T2', 'F1', 'F2', 'F3']),
  { r: 1, ev: { type: 'banishment', player: 'F1', role: 'faithful', method: 'majority' } },
  ...table(2, ['T1', 'T2', 'F2', 'F3']),
  ...vote(2, ['T1', 'T2', 'F2', 'F3']),
  { r: 2, ev: { type: 'banishment', player: 'T2', role: 'traitor', method: 'majority' } },
  ...table(3, ['T1', 'F2', 'F3']),
  ...vote(3, ['T1', 'F2', 'F3']),
  { r: 3, ev: { type: 'banishment', player: 'F2', role: 'faithful', method: 'majority' } },
], { winner: 'traitor' }, { T1: 'a', T2: 'b', F1: 'c', F2: 'd', F3: 'e', F4: 'f' });

const steps = buildGuessSteps(log);

describe('pickSetups', () => {
  it('lists who is still in and how many to pick, counting caught traitors off', () => {
    expect(pickSetups(log, steps)).toEqual([
      { round: 1, candidates: ['T1', 'T2', 'F1', 'F2', 'F3'], count: 2 },
      { round: 2, candidates: ['T1', 'T2', 'F2', 'F3'], count: 2 },
      { round: 3, candidates: ['T1', 'F2', 'F3'], count: 1 },
    ]);
  });
});

describe('scoreGuesses', () => {
  it('scores each round against the traitors then in the game', () => {
    const s = scoreGuesses(log, steps, { 1: ['T1', 'F2'], 2: ['T1', 'T2'], 3: ['F3'] });
    expect(s.rounds.map((r) => [r.round, r.traitors, r.correct, r.possible, r.result])).toEqual([
      [1, ['T1', 'T2'], 1, 2, 'some'],
      [2, ['T1', 'T2'], 2, 2, 'all'],
      [3, ['T1'], 0, 1, 'none'],
    ]);
    expect(s).toMatchObject({ correct: 3, possible: 5 });
  });

  it('scores a round with no picks as a miss, and ignores a pick that is not in the game', () => {
    const s = scoreGuesses(log, steps, { 3: ['T2', 'T1'] }); // T2 is already banished in round 3
    expect(s.rounds[0]).toMatchObject({ picks: [], correct: 0, result: 'none' });
    expect(s.rounds[2]).toMatchObject({ picks: ['T1'], correct: 1, result: 'all' });
  });

  it('scores everything right as all green', () => {
    const s = scoreGuesses(log, steps, { 1: ['T1', 'T2'], 2: ['T1', 'T2'], 3: ['T1'] });
    expect(s).toMatchObject({ correct: 5, possible: 5 });
    expect(emojiRow(s)).toBe('🟩🟩🟩');
  });
});

describe('sharing', () => {
  const s = scoreGuesses(log, steps, { 1: ['T1', 'F2'], 2: ['T1', 'T2'], 3: ['F3'] });

  it('makes a Wordle-style row and text with the episode number and link', () => {
    expect(emojiRow(s)).toBe('🟨🟩⬛');
    expect(shareText(s, 4, 'https://example.test/?mode=guess&log=ep')).toBe('Round Table #4 🟨🟩⬛ 3/5\nhttps://example.test/?mode=guess&log=ep');
    expect(shareText(s, null, 'https://x.test/')).toBe('Round Table 🟨🟩⬛ 3/5\nhttps://x.test/');
  });

  it('names no player and no role, so it spoils nothing', () => {
    const text = shareText(s, 4, 'https://example.test/?mode=guess&log=ep');
    for (const word of ['T1', 'T2', 'F1', 'F2', 'F3', 'traitor', 'faithful', 'Traitor', 'Faithful']) expect(text, word).not.toContain(word);
  });
});

describe('missedMoments', () => {
  it('shows what each missed traitor said and privately thought, only for rounds not fully right', () => {
    const s = scoreGuesses(log, steps, { 1: ['T1', 'F2'], 2: ['T1', 'T2'], 3: ['F3'] });
    expect(missedMoments(log, s)).toEqual([
      { round: 1, player: 'T2', said: 'T2 speaks', thought: 'T2 secretly plans' },
      { round: 3, player: 'T1', said: 'T1 speaks', thought: 'T1 secretly plans' },
    ]);
  });

  it('is empty when every round was right', () => {
    expect(missedMoments(log, scoreGuesses(log, steps, { 1: ['T1', 'T2'], 2: ['T1', 'T2'], 3: ['T1'] }))).toEqual([]);
  });
});
