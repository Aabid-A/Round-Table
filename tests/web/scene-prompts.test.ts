import { describe, expect, it } from 'vitest';
import { choosePrompt, chosenPrompt } from '../../web/src/scene/prompts.js';

describe('choosing prompts', () => {
  it('tell a touch screen to tap and never mention keys', () => {
    for (const s of [choosePrompt('Your turn.', 'accuse them', 'touch'), chosenPrompt('Dax', 'accuse them', 'touch')]) {
      expect(s).toMatch(/tap/i);
      expect(s).not.toMatch(/arrow|enter|select/i);
    }
  });
  it('tell a pointer and keyboard about selecting, the arrow keys and Enter', () => {
    expect(choosePrompt('Time to vote.', 'vote against them', 'keys')).toBe('Time to vote. Look at a figure and select them to vote against them, or use the arrow keys and Enter.');
    expect(chosenPrompt('Dax', 'slide your token to them', 'keys')).toContain('press Enter');
  });
});
