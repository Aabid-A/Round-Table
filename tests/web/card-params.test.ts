import { describe, expect, it } from 'vitest';
import { cardPixels, isCardPage, parseCardParams } from '../../web/src/card/params.js';

describe('isCardPage', () => {
  it('is true when ?card is present', () => {
    expect(isCardPage('?card=3&log=x')).toBe(true);
    expect(isCardPage('?mode=record')).toBe(false);
    expect(isCardPage('')).toBe(false);
  });
});

describe('parseCardParams', () => {
  it('reads the turn, log and size, defaulting to 1200x675', () => {
    expect(parseCardParams('?card=14&log=mock-seed-1')).toEqual({ ok: true, params: { turn: 14, size: '1200x675', log: 'mock-seed-1' } });
    expect(parseCardParams('?card=0&log=g&size=1080x1350')).toEqual({ ok: true, params: { turn: 0, size: '1080x1350', log: 'g' } });
  });

  it('says which parameter is wrong', () => {
    const bad: [string, string][] = [
      ['?card=&log=x', 'card must be a turn id'],
      ['?card=-1&log=x', 'card must be a turn id'],
      ['?card=1.5&log=x', 'card must be a turn id'],
      ['?card=abc&log=x', 'card must be a turn id'],
      ['?card=3', 'needs ?log='],
      ['?card=3&log=', 'needs ?log='],
      ['?card=3&log=../x', 'log must be a plain file name'],
      ['?card=3&log=a/b', 'log must be a plain file name'],
      ['?card=3&log=x&size=800x600', 'size must be 1200x675 or 1080x1350, not "800x600"'],
    ];
    for (const [q, why] of bad) expect(parseCardParams(q), q).toMatchObject({ ok: false, message: expect.stringContaining(why) });
  });
});

describe('cardPixels', () => {
  it('gives the pixel size of each card', () => {
    expect(cardPixels('1200x675')).toEqual({ width: 1200, height: 675 });
    expect(cardPixels('1080x1350')).toEqual({ width: 1080, height: 1350 });
  });
});
