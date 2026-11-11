import { describe, expect, it } from 'vitest';
import { formatLeft } from '../../web/src/rooms/time.js';

describe('formatLeft', () => {
  it('shows minutes and seconds, rounding up', () => {
    expect(formatLeft(90_000)).toBe('1:30');
    expect(formatLeft(65_000)).toBe('1:05');
    expect(formatLeft(59_001)).toBe('1:00');
    expect(formatLeft(1)).toBe('0:01');
  });
  it('never goes below zero', () => {
    expect(formatLeft(0)).toBe('0:00');
    expect(formatLeft(-500)).toBe('0:00');
  });
});
