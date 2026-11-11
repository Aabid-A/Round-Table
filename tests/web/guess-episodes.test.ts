import { describe, expect, it } from 'vitest';
import type { EpisodeIndex } from '../../src/log/episodes.js';
import { dayNumber, parseEpisodeIndex, pickEpisode } from '../../web/src/guess/episodes.js';

const entry = (number: number) => ({ number, name: `ep-${number}`, players: 8, traitors: 2, rounds: 3 });
const index: EpisodeIndex = { indexVersion: 1, episodes: [entry(1), entry(2), entry(3)] };

describe('parseEpisodeIndex', () => {
  it('accepts the index the CLI writes, and an empty one', () => {
    expect(parseEpisodeIndex(JSON.stringify(index))).toEqual({ ok: true, index });
    expect(parseEpisodeIndex(JSON.stringify({ indexVersion: 1, episodes: [] })).ok).toBe(true);
  });

  it('says what is wrong with anything else', () => {
    expect(parseEpisodeIndex('<html>')).toMatchObject({ ok: false, message: expect.stringContaining('not valid JSON') });
    expect(parseEpisodeIndex('[]')).toMatchObject({ ok: false, message: expect.stringContaining('expected format') });
    expect(parseEpisodeIndex(JSON.stringify({ indexVersion: 2, episodes: [] }))).toMatchObject({ ok: false, message: expect.stringContaining('indexVersion 1') });
    const bad = (e: unknown) => parseEpisodeIndex(JSON.stringify({ indexVersion: 1, episodes: [e] }));
    expect(bad({ ...entry(1), name: '../x' })).toMatchObject({ ok: false, message: expect.stringContaining('looks damaged') });
    expect(bad({ ...entry(1), players: 'eight' })).toMatchObject({ ok: false });
    expect(bad(null)).toMatchObject({ ok: false });
    expect(parseEpisodeIndex(JSON.stringify({ indexVersion: 1, episodes: [entry(1), entry(1)] }))).toMatchObject({ ok: false, message: expect.stringContaining('ep-1 appears twice') });
  });
});

describe('pickEpisode', () => {
  const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it('picks the same episode for everyone on the same UTC day, whatever the time or zone', () => {
    const a = pickEpisode(index, { kind: 'today' }, new Date('2026-11-11T00:00:01Z'));
    const b = pickEpisode(index, { kind: 'today' }, new Date('2026-11-11T23:59:59Z'));
    expect(a).toEqual(b);
  });

  it('moves to the next episode each day and cycles', () => {
    const picks = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map((d) => pickEpisode(index, { kind: 'today' }, on(d))!.number);
    expect(new Set(picks.slice(0, 3)).size).toBe(3);
    expect(picks[3]).toBe(picks[0]);
    expect(picks[1]).toBe((picks[0]! % 3) + 1);
    expect(picks[2]).toBe((picks[1]! % 3) + 1);
  });

  it('computes the day number from the UTC date', () => {
    expect(dayNumber(new Date('1970-01-02T00:00:00Z'))).toBe(1);
    expect(dayNumber(new Date('1970-01-01T23:59:59Z'))).toBe(0);
    expect(dayNumber(new Date('1969-12-31T12:00:00Z'))).toBe(-1);
  });

  it('picks by number, and returns null for an unknown number or an empty list', () => {
    expect(pickEpisode(index, { kind: 'number', number: 2 }, new Date())?.name).toBe('ep-2');
    expect(pickEpisode(index, { kind: 'number', number: 9 }, new Date())).toBeNull();
    expect(pickEpisode({ indexVersion: 1, episodes: [] }, { kind: 'today' }, new Date())).toBeNull();
    expect(pickEpisode({ indexVersion: 1, episodes: [] }, { kind: 'number', number: 1 }, new Date())).toBeNull();
  });

  it('copes with a date before 1970', () => {
    expect(pickEpisode(index, { kind: 'today' }, new Date('1969-12-30T00:00:00Z'))).not.toBeNull();
  });
});
