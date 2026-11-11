import { describe, expect, it } from 'vitest';
import { publicPhase } from '../src/publicPhase.js';
import type { Phase } from '../src/types.js';

describe('publicPhase', () => {
  it('shares one label between the two recruit phases and keeps the rest as they are', () => {
    expect(publicPhase('recruit_choose')).toBe('recruit');
    expect(publicPhase('recruit_respond')).toBe('recruit');
    const rest: Phase[] = ['night', 'whispers', 'round_table', 'vote', 'revote', 'endgame_vote'];
    for (const p of rest) expect(publicPhase(p)).toBe(p);
  });
});
