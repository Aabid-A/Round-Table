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
});
