import { describe, expect, it } from 'vitest';
import type { RoomOutcome } from '../../src/roomResult.js';
import { foolingLine, joinNames, personOf, scoreLine } from '../../web/src/rooms/outcome.js';

const outcome: RoomOutcome = {
  people: [{ seat: 'Cleo', person: 'Quinn' }, { seat: 'Dax', person: 'Rae' }],
  scores: null,
  fooling: null,
  trust: null,
};

describe('joinNames', () => {
  it('reads like a sentence', () => {
    expect([joinNames([]), joinNames(['Rae']), joinNames(['Rae', 'Sam']), joinNames(['Rae', 'Sam', 'Tia'])]).toEqual(['', 'Rae', 'Rae and Sam', 'Rae, Sam and Tia']);
  });
});

describe('personOf', () => {
  it('gives the person behind an alias, and the seat itself when there is no alias for it', () => {
    expect(personOf(outcome, 'Cleo')).toBe('Quinn');
    expect(personOf(outcome, 'Aria')).toBe('Aria');
    expect(personOf({ ...outcome, people: [] }, 'Quinn')).toBe('Quinn'); // a room without aliases
  });
});

describe('foolingLine', () => {
  it('names the people who were fooled, by their real names, and says whether the seat was an AI or a person', () => {
    expect(foolingLine(outcome, { seat: 'Bram', isAi: true, fooled: ['Cleo', 'Dax'] })).toBe('Bram (an AI) fooled Quinn and Rae.');
    expect(foolingLine(outcome, { seat: 'Dax', isAi: false, fooled: ['Cleo'] })).toBe('Dax (Rae) fooled Quinn.');
  });
  it('says when no one was fooled, and works without aliases', () => {
    expect(foolingLine(outcome, { seat: 'Aria', isAi: true, fooled: [] })).toBe('Aria (an AI) fooled no one.');
    expect(foolingLine({ ...outcome, people: [] }, { seat: 'Rae', isAi: false, fooled: ['Sam'] })).toBe('Rae fooled Sam.');
  });
});

describe('scoreLine', () => {
  it('uses the real name', () => {
    expect(scoreLine({ seat: 'Cleo', person: 'Quinn', correct: 5, of: 7, wrong: ['Aria', 'Bram'] })).toBe('Quinn got 5 of 7 right.');
  });
});
