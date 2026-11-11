import { describe, expect, it } from 'vitest';
import { shareText } from '../../web/src/rooms/shareText.js';
import { logFrom } from '../helpers/logs.js';

const roles = { Aria: 'traitor', Bram: 'faithful', Cleo: 'faithful', Dax: 'traitor', Eve: 'faithful' } as const;
const log = logFrom({ ...roles }, [], { winner: 'traitor', reason: 'endgame_vote' }, { Cleo: 'human', Eve: 'human' });
const link = 'https://play.example.org/?log=room-AB2CD-seed-4';

describe('shareText', () => {
  it('says how many people and AIs, how the person did, and gives the link', () => {
    expect(shareText(log, { seat: 'Cleo', correct: 5, of: 7, wrong: [] }, link)).toBe(
      `I just played Round Table: 2 people and 3 AIs, and nobody knew which was which. I got 5 of 7 right on who was an AI. Watch the replay and see if you can tell: ${link}`,
    );
  });

  it('leaves the score out when there was no guess', () => {
    const text = shareText(log, undefined, link);
    expect(text).not.toContain('I got');
    expect(text).toContain(link);
  });

  it('does not spoil the game: nothing about the winner, the traitors, the roles or which seats were AIs', () => {
    const text = shareText(log, { seat: 'Cleo', correct: 5, of: 7, wrong: ['Aria'] }, link).toLowerCase();
    for (const spoiler of ['win', 'won', 'trait', 'faithful', 'banish', 'murder', 'trusted', 'fooled', ...Object.keys(roles).map((n) => n.toLowerCase())]) {
      expect(text, `mentions "${spoiler}"`).not.toContain(spoiler);
    }
  });

  it('uses the singular for one person or one AI', () => {
    const small = logFrom({ Aria: 'traitor', Bram: 'faithful' }, [], {}, { Bram: 'human' });
    expect(shareText(small, undefined, link)).toContain('1 person and 1 AI,');
  });
});
