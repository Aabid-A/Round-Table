import { describe, expect, it } from 'vitest';
import { resultCardAlt } from '../../web/src/guess/resultAlt.js';
import type { GuessScore } from '../../web/src/guess/score.js';

const score: GuessScore = {
  rounds: [
    { round: 1, picks: ['T1', 'F2'], traitors: ['T1', 'T2'], correct: 1, possible: 2, result: 'some' },
    { round: 2, picks: ['T1', 'T2'], traitors: ['T1', 'T2'], correct: 2, possible: 2, result: 'all' },
    { round: 3, picks: ['F3'], traitors: ['T1'], correct: 0, possible: 1, result: 'none' },
  ],
  correct: 3,
  possible: 5,
};

describe('resultCardAlt', () => {
  it('says the episode, the score and what happened each round', () => {
    expect(resultCardAlt(score, 4)).toBe('Round Table episode 4. Found 3 of 5 traitor spots. round 1: found some; round 2: found every traitor; round 3: found none.');
    expect(resultCardAlt(score, null)).toMatch(/^Round Table\. Found 3 of 5/);
  });

  it('says so when there was nothing to guess', () => {
    expect(resultCardAlt({ rounds: [], correct: 0, possible: 0 }, 2)).toBe('Round Table episode 2. There was nothing to guess in this episode.');
  });

  it('names no player', () => {
    const alt = resultCardAlt(score, 4);
    for (const name of ['T1', 'T2', 'F2', 'F3']) expect(alt).not.toContain(name);
  });
});
