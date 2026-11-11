import { describe, expect, it } from 'vitest';
import { parseSeeds } from '../../src/cli/seeds.js';

describe('parseSeeds', () => {
  it('reads a single seed, a range and a mixed list', () => {
    expect(parseSeeds('7')).toEqual([7]);
    expect(parseSeeds('1-4')).toEqual([1, 2, 3, 4]);
    expect(parseSeeds('1,5, 9-11')).toEqual([1, 5, 9, 10, 11]);
  });
  it('rejects junk, backwards ranges and huge runs', () => {
    expect(() => parseSeeds('')).toThrow('--seeds');
    expect(() => parseSeeds('a-b')).toThrow('cannot read');
    expect(() => parseSeeds('-3')).toThrow('cannot read');
    expect(() => parseSeeds('5-2')).toThrow('backwards');
    expect(() => parseSeeds('1-5000')).toThrow('at most');
  });
});
