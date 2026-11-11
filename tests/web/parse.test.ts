import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGameLog } from '../../web/src/replay/parse.js';

const fixture = readFileSync('tests/fixtures/sample-game.json', 'utf8');

describe('parseGameLog', () => {
  it('accepts a v1 log', () => {
    const r = parseGameLog(fixture);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.log.cast).toHaveLength(8);
  });

  it('rejects another schemaVersion with a clear message', () => {
    const r = parseGameLog(JSON.stringify({ ...JSON.parse(fixture), schemaVersion: 2 }));
    expect(r).toEqual({ ok: false, message: 'This log uses schemaVersion 2. This viewer reads schemaVersion 1.' });
  });

  it('rejects text that is not JSON, not an object, or has no schemaVersion', () => {
    expect(parseGameLog('<html>')).toMatchObject({ ok: false, message: expect.stringContaining('not valid JSON') });
    expect(parseGameLog('[1,2]')).toMatchObject({ ok: false, message: expect.stringContaining('not a game log') });
    expect(parseGameLog('{"turns":[]}')).toMatchObject({ ok: false, message: expect.stringContaining('no schemaVersion') });
  });

  it('rejects a v1 log that is missing parts', () => {
    expect(parseGameLog('{"schemaVersion":1,"cast":[]}')).toMatchObject({ ok: false, message: expect.stringContaining('missing parts') });
  });

  it('rejects a v1 log whose turns, events or result are damaged, instead of failing later on screen', () => {
    const good = JSON.parse(fixture);
    const damaged = (edit: (l: Record<string, any>) => void): string => {
      const copy = JSON.parse(JSON.stringify(good));
      edit(copy);
      return JSON.stringify(copy);
    };
    const cases: [string, (l: Record<string, any>) => void, string][] = [
      ['a turn without private_notes', (l) => delete l.turns[3].private_notes, 'turn 3 is missing a field'],
      ['a turn with no action', (l) => (l.turns[0].action = null), 'turn 0 is missing a field'],
      ['an event without afterTurn', (l) => delete l.events[2].afterTurn, 'event 2 is missing a field'],
      ['a result without survivors', (l) => delete l.result.survivors, 'the result is missing a field'],
      ['an empty result', (l) => (l.result = {}), 'the result is missing a field'],
      ['an empty cast', (l) => (l.cast = []), 'the cast is empty'],
      ['a cast entry without a model', (l) => delete l.cast[1].model, 'a cast entry has no name or model'],
    ];
    for (const [label, edit, why] of cases) {
      const r = parseGameLog(damaged(edit));
      expect(r, label).toMatchObject({ ok: false, message: expect.stringContaining(why) });
      expect(r.ok === false && r.message, label).toContain('looks damaged');
    }
  });
});
