import { describe, expect, it } from 'vitest';
import { isPlayMode, seedFromSearch } from '../../web/src/play/params.js';

describe('play params', () => {
  it('knows play mode', () => {
    expect(isPlayMode('?mode=play')).toBe(true);
    expect(isPlayMode('?mode=guess')).toBe(false);
    expect(isPlayMode('')).toBe(false);
  });

  it('uses ?seed= when it is a whole number, otherwise a random seed in range', () => {
    expect(seedFromSearch('?mode=play&seed=42')).toBe(42);
    expect(seedFromSearch('?seed=0')).toBe(0);
    for (const bad of ['?seed=-1', '?seed=1.5', '?seed=abc', '?seed=', '', '?seed=9999999999']) {
      expect(seedFromSearch(bad, () => 0.5), bad).toBe(Math.floor(0.5 * 2 ** 31));
    }
    const r = seedFromSearch('', () => 0.999999);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(2 ** 31);
  });
});
