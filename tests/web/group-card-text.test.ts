import { describe, expect, it } from 'vitest';
import { outcomeFor } from '../../src/roomResult.js';
import { groupCardText } from '../../web/src/rooms/groupCardText.js';
import { logFrom } from '../helpers/logs.js';

const vote = (r: number, votes: [string, string][]) => ({ r, ev: { type: 'vote' as const, stage: 'vote' as const, votes: votes.map(([voter, target]) => ({ voter, target })), tally: {}, leaders: [] } });
// Eight seats: Cleo, Dax and Eve are people; Aria and Fay are AI traitors.
const roles = { Aria: 'traitor', Bram: 'faithful', Cleo: 'faithful', Dax: 'faithful', Eve: 'faithful', Fay: 'traitor', Gus: 'faithful', Hal: 'faithful' } as const;
const models = { Cleo: 'human', Dax: 'human', Eve: 'human' };
const log = logFrom({ ...roles }, [vote(1, [['Cleo', 'Aria'], ['Dax', 'Bram'], ['Eve', 'Bram']])], {}, models);
const people = { Cleo: 'Quinn', Dax: 'Rae', Eve: 'Sam' };

describe('groupCardText', () => {
  it('leads with how many people trusted the AI traitor, then who was at the table, the guesses and who fooled most', () => {
    const outcome = outcomeFor(log, people, [
      { seat: 'Cleo', ai: ['Aria', 'Bram', 'Fay', 'Gus', 'Hal'] }, // all 7 right
      { seat: 'Dax', ai: [] }, // calls everyone a person: right about the two other people only, so 2 of 7
      { seat: 'Eve', ai: ['Aria', 'Bram', 'Fay', 'Gus', 'Hal'] }, // all right
    ]);
    const card = groupCardText(log, outcome);
    expect(card.headline).toBe('2 of 3 humans trusted the AI traitor');
    expect(card.lines[0]).toBe('3 people and 5 AIs at the table');
    expect(card.lines[1]).toBe('Average guess: 5.3 of 7 right. Best: Quinn, 7.');
    expect(card.lines[2]).toMatch(/fooled Rae\.$/); // only Rae was wrong, about the five AIs
  });

  it('has a plain title and no guess lines when there was no guessing and nobody voted', () => {
    const quiet = logFrom({ ...roles }, [], {}, models);
    expect(groupCardText(quiet, outcomeFor(quiet, {}, null))).toEqual({ headline: 'Human or AI?', lines: ['3 people and 5 AIs at the table'] });
  });

  it('says nobody was fooled when every guess was right', () => {
    const right = ['Aria', 'Bram', 'Fay', 'Gus', 'Hal'];
    const outcome = outcomeFor(log, people, [{ seat: 'Cleo', ai: right }, { seat: 'Dax', ai: right }, { seat: 'Eve', ai: right }]);
    expect(groupCardText(log, outcome).lines.at(-1)).toBe('Nobody was fooled.');
  });
});
