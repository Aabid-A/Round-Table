import { describe, expect, it } from 'vitest';
import { isEpisodesPage, isGuessMode, parseGuessParams } from '../../web/src/guess/params.js';

describe('page detection', () => {
  it('knows guess mode and the episodes page', () => {
    expect(isGuessMode('?mode=guess')).toBe(true);
    expect(isGuessMode('?mode=record')).toBe(false);
    expect(isEpisodesPage('?page=episodes')).toBe(true);
    expect(isEpisodesPage('?page=stats')).toBe(false);
  });
});

describe('parseGuessParams', () => {
  it('reads a log, today, an episode number and a date', () => {
    expect(parseGuessParams('?mode=guess&log=ep-1')).toEqual({ ok: true, params: { log: 'ep-1', episode: null, label: null, date: null } });
    expect(parseGuessParams('?mode=guess&episode=today')).toEqual({ ok: true, params: { log: null, episode: { kind: 'today' }, label: null, date: null } });
    expect(parseGuessParams('?mode=guess&episode=3')).toEqual({ ok: true, params: { log: null, episode: { kind: 'number', number: 3 }, label: null, date: null } });
    expect(parseGuessParams('?mode=guess&episode=today&date=2026-11-11')).toMatchObject({ ok: true, params: { date: '2026-11-11' } });
  });

  it('keeps the episode number as a label when a log is named directly', () => {
    expect(parseGuessParams('?mode=guess&log=ep-1&episode=7')).toMatchObject({ ok: true, params: { log: 'ep-1', label: 7 } });
  });

  it('allows no log and no episode (the page then lists episodes)', () => {
    expect(parseGuessParams('?mode=guess')).toEqual({ ok: true, params: { log: null, episode: null, label: null, date: null } });
  });

  it('says which parameter is wrong', () => {
    const bad: [string, string][] = [
      ['?log=../x', 'log must be a plain file name'],
      ['?log=a/b', 'log must be a plain file name'],
      ['?episode=0', 'episode must be'],
      ['?episode=-2', 'episode must be'],
      ['?episode=tomorrow', 'episode must be'],
      ['?episode=1.5', 'episode must be'],
      ['?episode=today&date=11-11-2026', 'date must look like'],
      ['?episode=today&date=2026-13-45', 'date is not a real date'],
    ];
    for (const [q, why] of bad) expect(parseGuessParams(q), q).toMatchObject({ ok: false, message: expect.stringContaining(why) });
  });
});
