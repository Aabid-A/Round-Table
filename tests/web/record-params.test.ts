import { describe, expect, it } from 'vitest';
import { isRecordMode, parseRecordParams } from '../../web/src/record/params.js';

describe('isRecordMode', () => {
  it('is true only for mode=record', () => {
    expect(isRecordMode('?mode=record')).toBe(true);
    expect(isRecordMode('?mode=guess')).toBe(false);
    expect(isRecordMode('')).toBe(false);
  });
});

describe('parseRecordParams', () => {
  it('defaults to 16x9, the whole episode, normal speed', () => {
    expect(parseRecordParams('?mode=record&log=x')).toEqual({
      ok: true,
      params: { aspect: '16x9', from: null, to: null, faces: null, speed: 1, seats: null },
    });
  });

  it('reads aspect, a range, faces and speed', () => {
    expect(parseRecordParams('?mode=record&aspect=9x16&from=3&to=9&speed=2.5')).toEqual({
      ok: true,
      params: { aspect: '9x16', from: 3, to: 9, faces: null, speed: 2.5, seats: null },
    });
    expect(parseRecordParams('?faces=7')).toMatchObject({ ok: true, params: { faces: 7 } });
    expect(parseRecordParams('?from=0&to=0')).toMatchObject({ ok: true, params: { from: 0, to: 0 } });
  });

  it('accepts the speed limits themselves', () => {
    expect(parseRecordParams('?speed=0.05')).toMatchObject({ ok: true, params: { speed: 0.05 } });
    expect(parseRecordParams('?speed=100')).toMatchObject({ ok: true, params: { speed: 100 } });
  });

  it('says which parameter is wrong', () => {
    const bad: [string, string][] = [
      ['?aspect=4x3', 'aspect must be'],
      ['?from=-1', 'from must be a turn id'],
      ['?to=abc', 'to must be a turn id'],
      ['?faces=1.5', 'faces must be a turn id'],
      ['?from=9&to=3', 'to (3) comes before from (9)'],
      ['?speed=0', 'speed must be'],
      ['?speed=abc', 'speed must be'],
      ['?speed=1000', 'speed must be'],
      ['?speed=0.01', 'speed must be a number from 0.05 to 100'],
      ['?speed=1e-9', 'speed must be'],
    ];
    for (const [q, why] of bad) {
      expect(parseRecordParams(q), q).toMatchObject({ ok: false, message: expect.stringContaining(why) });
    }
  });
});

describe('parseRecordParams: seats', () => {
  it('reads one seat or two, and keeps the other parameters', () => {
    expect(parseRecordParams('?mode=record&seat=Aria')).toMatchObject({ ok: true, params: { seats: ['Aria'] } });
    expect(parseRecordParams('?mode=record&aspect=9x16&seats=Aria,Bram&from=3')).toMatchObject({
      ok: true,
      params: { aspect: '9x16', from: 3, seats: ['Aria', 'Bram'] },
    });
  });

  it('says what is wrong with the seat parameters', () => {
    const bad: [string, string][] = [
      ['?seat=A&seats=B,C', 'not both'],
      ['?seat=', 'seat needs a name'],
      ['?seats=A', 'two names'],
      ['?seats=A,B,C', 'two names'],
      ['?seats=A,', 'two names'],
      ['?seats=A,A', 'two different seats'],
    ];
    for (const [search, text] of bad) expect(parseRecordParams(search), search).toEqual({ ok: false, message: expect.stringContaining(text) });
  });
});
