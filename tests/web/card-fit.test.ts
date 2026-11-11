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

  it('never splits an emoji or other character outside the basic plane', () => {
    const out = clipQuote('😀'.repeat(20), 11);
    expect(out).toBe(`${'😀'.repeat(11)}…`);
    expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/);
    expect(clipQuote('😀'.repeat(11), 11)).toBe('😀'.repeat(11));
    expect(clipQuote('日本語のテキスト'.repeat(10), 12)).toBe(`${'日本語のテキスト日本語の'}…`);
  });

  it('does not leave punctuation before the ellipsis, and cuts mid-word for one long word', () => {
    expect(clipQuote('wait, wait, wait, wait, wait', 12)).toBe('wait, wait…');
    expect(clipQuote('a'.repeat(50), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

describe('cardTextScale', () => {
  it('grows a short quote and shrinks a long one, in steps, differently for each shape', () => {
    expect(cardTextScale(50, '1200x675')).toBe(1.25);
    expect(cardTextScale(100, '1200x675')).toBe(1);
    expect(cardTextScale(150, '1200x675')).toBe(0.8);
    expect(cardTextScale(250, '1200x675')).toBe(0.66);
    expect(cardTextScale(360, '1200x675')).toBe(0.56);
    expect(cardTextScale(50, '1080x1350')).toBe(1.5);
    expect(cardTextScale(120, '1080x1350')).toBe(1.2);
    expect(cardTextScale(200, '1080x1350')).toBe(1);
    expect(cardTextScale(560, '1080x1350')).toBe(0.62);
  });

  it('never grows with length and keeps a readable floor at the longest quote a card shows', () => {
    for (const size of ['1200x675', '1080x1350'] as const) {
      let prev = Number.POSITIVE_INFINITY;
      for (let n = 0; n <= MAX_QUOTE_CHARS[size] + 1; n += 5) {
        const s = cardTextScale(n, size);
        expect(s).toBeLessThanOrEqual(prev);
        expect(s).toBeGreaterThanOrEqual(0.56);
        prev = s;
      }
    }
  });
});
