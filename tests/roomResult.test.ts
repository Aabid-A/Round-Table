import { describe, expect, it } from 'vitest';
import { isHumanSeat, scoreGuesses, trustedTraitor, trustHeadline, whoFooledWhom } from '../src/roomResult.js';
import { logFrom } from './helpers/logs.js';

// Four seats: Aria and Bram are AIs, Cleo and Dax are people.
const log = logFrom({ Aria: 'traitor', Bram: 'faithful', Cleo: 'faithful', Dax: 'traitor' }, [], {}, { Cleo: 'human', Dax: 'human' });

describe('isHumanSeat', () => {
  it('reads it from the cast', () => {
    expect([isHumanSeat(log, 'Aria'), isHumanSeat(log, 'Cleo'), isHumanSeat(log, 'Nobody')]).toEqual([false, true, false]);
  });
});

describe('scoreGuesses', () => {
  it('counts every other seat as one call, and lists the ones got wrong', () => {
    const [cleo, dax] = scoreGuesses(log, [
      { seat: 'Cleo', ai: ['Aria', 'Bram'] }, // calls both AIs right and Dax (a person) a person: all 3 right
      { seat: 'Dax', ai: ['Aria', 'Cleo'] }, // Bram (AI) called a person, Cleo (a person) called AI
    ]);
    expect(cleo).toEqual({ seat: 'Cleo', correct: 3, of: 3, wrong: [] });
    expect(dax).toEqual({ seat: 'Dax', correct: 1, of: 3, wrong: ['Bram', 'Cleo'] });
  });

  it('does not count a person\'s own seat, even if they list it', () => {
    const [s] = scoreGuesses(log, [{ seat: 'Cleo', ai: ['Cleo', 'Aria', 'Bram'] }]);
    expect(s).toEqual({ seat: 'Cleo', correct: 3, of: 3, wrong: [] });
  });

  it('scores calling everyone a person, or everyone an AI, by how many each side has', () => {
    const [none, all] = scoreGuesses(log, [{ seat: 'Cleo', ai: [] }, { seat: 'Dax', ai: ['Aria', 'Bram', 'Cleo'] }]);
    expect(none).toMatchObject({ correct: 1, wrong: ['Aria', 'Bram'] }); // only Dax was a person
    expect(all).toMatchObject({ correct: 2, wrong: ['Cleo'] }); // both AIs right, Cleo wrong
  });
});

describe('whoFooledWhom', () => {
  it('lists, for each seat, the people who got it wrong, most fooling first and ties in seat order', () => {
    const scores = scoreGuesses(log, [{ seat: 'Cleo', ai: ['Aria'] }, { seat: 'Dax', ai: ['Aria', 'Cleo'] }]);
    // Cleo: Bram called a person (wrong); Dax right about Aria. Dax: Bram wrong, Cleo called AI (wrong).
    expect(whoFooledWhom(log, scores)).toEqual([
      { seat: 'Bram', isAi: true, fooled: ['Cleo', 'Dax'] },
      { seat: 'Cleo', isAi: false, fooled: ['Dax'] },
      { seat: 'Aria', isAi: true, fooled: [] }, // nobody fooled: kept in seat order, Aria before Dax
      { seat: 'Dax', isAi: false, fooled: [] },
    ]);
  });

  it('is empty of fooling when everyone guessed right', () => {
    const scores = scoreGuesses(log, [{ seat: 'Cleo', ai: ['Aria', 'Bram'] }, { seat: 'Dax', ai: ['Aria', 'Bram'] }]);
    expect(whoFooledWhom(log, scores).every((r) => r.fooled.length === 0)).toBe(true);
  });
});

describe('trustedTraitor', () => {
  const vote = (r: number, votes: [string, string][]) => ({ r, ev: { type: 'vote' as const, stage: 'vote' as const, votes: votes.map(([voter, target]) => ({ voter, target })), tally: {}, leaders: [] } });
  const models = { Cleo: 'human', Dax: 'human', Eve: 'human' };
  const roles = { Aria: 'traitor', Bram: 'faithful', Cleo: 'faithful', Dax: 'faithful', Eve: 'faithful', Fay: 'traitor' } as const;

  it('counts the people who never voted against the AI traitor, among the people who voted', () => {
    const l = logFrom({ ...roles }, [
      vote(1, [['Cleo', 'Aria'], ['Dax', 'Bram'], ['Eve', 'Bram']]),
      vote(2, [['Cleo', 'Fay'], ['Dax', 'Fay'], ['Eve', 'Bram']]),
    ], {}, models);
    // Aria is an AI traitor still there at the end; only Cleo voted against Aria.
    const t = trustedTraitor(l);
    expect(t).toEqual({ seat: 'Aria', isAi: true, trusted: 2, of: 3 });
    expect(trustHeadline(t!)).toBe('2 of 3 humans trusted the AI traitor');
  });

  it('picks the AI traitor who lasted longest', () => {
    const l = logFrom({ ...roles }, [
      vote(1, [['Cleo', 'Bram'], ['Dax', 'Bram'], ['Eve', 'Bram']]),
      { r: 1, ev: { type: 'banishment', player: 'Aria', role: 'traitor', method: 'majority' } },
    ], {}, models);
    expect(trustedTraitor(l)?.seat).toBe('Fay'); // Aria was banished in round 1, Fay never was
  });

  it('leaves out a person who never got to vote, and says "human" when no AI was a traitor', () => {
    const l = logFrom({ Aria: 'faithful', Bram: 'faithful', Cleo: 'traitor', Dax: 'faithful', Eve: 'faithful' }, [
      vote(1, [['Dax', 'Bram']]), // Eve never voted
    ], {}, { Cleo: 'human', Dax: 'human', Eve: 'human' });
    const t = trustedTraitor(l);
    expect(t).toEqual({ seat: 'Cleo', isAi: false, trusted: 1, of: 1 });
    expect(trustHeadline(t!)).toBe('1 of 1 human trusted the human traitor');
  });

  it('is null when no person voted', () => {
    expect(trustedTraitor(logFrom({ ...roles }, [], {}, models))).toBeNull();
  });
});
