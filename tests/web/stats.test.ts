import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStats } from '../../web/src/stats/parse.js';
import { firstDirection, sortModels, valueFor } from '../../web/src/stats/sort.js';

const fixture = readFileSync('tests/fixtures/sample-stats.json', 'utf8');
const stats = (): ReturnType<typeof JSON.parse> => JSON.parse(fixture);

describe('parseStats', () => {
  it('accepts the stats the CLI writes', () => {
    const r = parseStats(fixture);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stats.models).toHaveLength(4);
  });

  it('accepts a season with no models', () => {
    expect(parseStats(JSON.stringify({ statsVersion: 1, games: 0, decidedGames: 0, models: [] })).ok).toBe(true);
  });

  it('says what is wrong with other files', () => {
    expect(parseStats('<html>')).toMatchObject({ ok: false, message: expect.stringContaining('not valid JSON') });
    expect(parseStats('[]')).toMatchObject({ ok: false, message: expect.stringContaining('no statsVersion') });
    expect(parseStats(JSON.stringify({ games: 1 }))).toMatchObject({ ok: false, message: expect.stringContaining('no statsVersion') });
    expect(parseStats(JSON.stringify({ ...stats(), statsVersion: 2 }))).toEqual({
      ok: false,
      message: 'These stats use statsVersion 2. This page reads statsVersion 1.',
    });
    expect(parseStats(JSON.stringify({ statsVersion: 1, games: 1 }))).toMatchObject({ ok: false, message: expect.stringContaining('missing parts') });
  });

  it('rejects negative numbers, a fallback rate above 1, and a model listed twice', () => {
    const neg = stats();
    neg.models[0].caughtAsTraitor = -1;
    expect(parseStats(JSON.stringify(neg))).toMatchObject({ ok: false, message: expect.stringContaining('negative one') });
    const rate = stats();
    rate.models[0].fallbackRate = 7;
    expect(parseStats(JSON.stringify(rate))).toMatchObject({ ok: false, message: expect.stringContaining('fallback rate above 1') });
    const twice = stats();
    twice.models[1].model = twice.models[0].model;
    expect(parseStats(JSON.stringify(twice))).toMatchObject({ ok: false, message: expect.stringContaining('appears twice') });
  });

  it('rejects a damaged model entry by name', () => {
    const s = stats();
    delete s.models[1].asTraitor;
    expect(parseStats(JSON.stringify(s))).toMatchObject({ ok: false, message: `These stats look damaged: ${s.models[1].model} is missing a number, or has a negative one.` });
    const t = stats();
    t.models[0].betrayalIndex = 'high';
    expect(parseStats(JSON.stringify(t))).toMatchObject({ ok: false, message: expect.stringContaining('look damaged') });
    const u = stats();
    u.models[2] = { games: 1 };
    expect(parseStats(JSON.stringify(u))).toMatchObject({ ok: false, message: expect.stringContaining('a model has no name') });
  });
});

describe('sortModels', () => {
  const models = (parseStats(fixture) as { ok: true; stats: { models: Parameters<typeof sortModels>[0] } }).stats.models;
  const names = (ms: typeof models): string[] => ms.map((m) => m.model);

  it('sorts numbers either way and leaves the input alone', () => {
    const before = names(models);
    expect(names(sortModels(models, 'games', 'desc'))[0]).toBe('model-c'); // 3 seats
    expect(names(sortModels(models, 'games', 'asc')).at(-1)).toBe('model-c');
    expect(names(models)).toEqual(before);
  });

  it('sorts names A to Z and Z to A', () => {
    expect(names(sortModels(models, 'model', 'asc'))).toEqual(['model-a', 'model-b', 'model-c', 'model-d']);
    expect(names(sortModels(models, 'model', 'desc'))).toEqual(['model-d', 'model-c', 'model-b', 'model-a']);
  });

  it('computes win rates, with no games meaning 0, and keeps the file order for ties', () => {
    const a = models.find((m) => m.model === 'model-a')!;
    expect(valueFor(a, 'traitorWinRate')).toBe(0.5);
    expect(valueFor(a, 'faithfulWinRate')).toBe(0);
    const tied = sortModels(models, 'recruitOffersAccepted', 'asc');
    expect(names(tied).slice(0, 3)).toEqual(names(models).filter((n) => n !== 'model-c'));
  });

  it('orders names by code, not by locale: capitals first', () => {
    const base = models[0]!;
    const mixed = ['b-model', 'B-model', 'a-model'].map((model) => ({ ...base, model }));
    expect(sortModels(mixed, 'model', 'asc').map((m) => m.model)).toEqual(['B-model', 'a-model', 'b-model']);
  });

  it('starts names A to Z and numbers biggest first', () => {
    expect(firstDirection('model')).toBe('asc');
    expect(firstDirection('betrayalIndex')).toBe('desc');
  });
});
