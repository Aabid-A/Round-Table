import { describe, expect, it } from 'vitest';
import { cueForStage } from '../../web/src/slice/cues.js';

describe('the sound of each stage', () => {
  it('makes a sound for each staged moment and none for the quiet ones', () => {
    expect(cueForStage({ kind: 'pointed' })).toBe('point');
    expect(cueForStage({ kind: 'tally' })).toBe('token');
    expect(cueForStage({ kind: 'banish', step: 'pushback' })).toBe('chair');
    expect(cueForStage({ kind: 'banish', step: 'mask' })).toBe('mask');
    expect(cueForStage({ kind: 'night' })).toBe('snuff');
    expect(cueForStage({ kind: 'dawn' })).toBe('dawn');
    expect(cueForStage({ kind: 'intro' })).toBeNull();
    expect(cueForStage({ kind: 'speak', i: 0 })).toBeNull();
    expect(cueForStage({ kind: 'banish', step: 'leave' })).toBeNull();
  });
});
