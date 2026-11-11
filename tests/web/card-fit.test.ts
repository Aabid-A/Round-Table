import { describe, expect, it } from 'vitest';
import { cardTextScale, clipQuote, MAX_QUOTE_CHARS } from '../../web/src/card/fit.js';

describe('clipQuote', () => {
  it('leaves a short quote alone', () => {
    expect(clipQuote('Hello there.', 100)).toBe('Hello there.');
    expect(clipQuote('x'.repeat(100), 100)).toBe('x'.repeat(100));
  });

  it('cuts a long quote at a word and adds an ellipsis, never going over the limit', () => {
    const text = 'one two three four five six seven eight nine ten';
    const out = clipQuote(text, 20);
    expect(out).toBe('one two three four…');
    expect(out.length).toBeLessThanOrEqual(21);
    for (const n of [5, 17, 30, 44]) expect(clipQuote(text, n).length).toBeLessThanOrEqual(n + 1);
  });

  it('does not leave punctuation before the ellipsis, and cuts mid-word for one long word', () => {
    expect(clipQuote('wait, wait, wait, wait, wait', 12)).toBe('wait, wait…');
    expect(clipQuote('a'.repeat(50), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

describe('cardTextScale', () => {
  it('shrinks in steps with length, differently for each shape', () => {
    expect(cardTextScale(50, '1200x675')).toBe(1);
    expect(cardTextScale(150, '1200x675')).toBe(0.8);
    expect(cardTextScale(250, '1200x675')).toBe(0.66);
    expect(cardTextScale(360, '1200x675')).toBe(0.56);
    expect(cardTextScale(150, '1080x1350')).toBe(1);
    expect(cardTextScale(560, '1080x1350')).toBe(0.56);
  });

  it('never grows with length and has a readable floor at the longest quote a card shows', () => {
    for (const size of ['1200x675', '1080x1350'] as const) {
      let prev = 1;
      for (let n = 0; n <= MAX_QUOTE_CHARS[size] + 1; n += 5) {
        const s = cardTextScale(n, size);
        expect(s).toBeLessThanOrEqual(prev);
        expect(s).toBeGreaterThanOrEqual(0.56);
        prev = s;
      }
    }
  });
});
