import { describe, expect, it } from 'vitest';
import { textScale } from '../../web/src/record/fit.js';

describe('textScale', () => {
  it('keeps short text full size and shrinks longer text in steps', () => {
    expect(textScale(0)).toBe(1);
    expect(textScale(100)).toBe(1);
    expect(textScale(101)).toBe(0.8);
    expect(textScale(200)).toBe(0.8);
    expect(textScale(300)).toBe(0.64);
    expect(textScale(480)).toBe(0.52);
  });

  it('never goes below a readable floor and never grows with length', () => {
    expect(textScale(100000)).toBe(0.44);
    let prev = 1;
    for (let n = 0; n < 700; n += 7) {
      const s = textScale(n);
      expect(s).toBeLessThanOrEqual(prev);
      expect(s).toBeGreaterThanOrEqual(0.44);
      prev = s;
    }
  });
});
