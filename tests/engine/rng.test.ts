import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng.js';

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('keeps next() in [0, 1) and int() in range', () => {
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      expect(r.int(5)).toBeLessThan(5);
    }
  });

  it('shuffles into a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = createRng(3).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it('throws when picking from an empty list', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});
