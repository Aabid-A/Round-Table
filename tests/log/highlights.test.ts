import { describe, expect, it } from 'vitest';
import { findHighlights, isValidLogName } from '../../src/log/highlights/index.js';
import { parseRecordParams } from '../../web/src/record/params.js';
import { playMock } from '../helpers/game.js';
import { logFrom, type Spec } from '../helpers/logs.js';

const roles = { T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful', F3: 'faithful' } as const;

/** A game with a recruit, a whisper to a night target, and a faithful banished by majority. */
const rich = (): ReturnType<typeof logFrom> => {
  const votes = [{ voter: 'T1', target: 'F3' }, { voter: 'T2', target: 'F3' }, { voter: 'F1', target: 'F3' }];
  const specs: Spec[] = [
    { r: 1, phase: 'night', p: 'T1', action: { target: 'F1' } },
    { r: 1, phase: 'night', p: 'T2', action: { target: 'F2' } },
    { r: 1, ev: { type: 'murder', victim: 'F2', proposals: [], method: 'random' } },
    { r: 1, ev: { type: 'breakfast', victim: 'F2', role: 'faithful' } },
    { r: 1, phase: 'whispers', p: 'T1', action: { to: 'F1', message: 'hi' }, notes: 'keep close' },
    { r: 1, ev: { type: 'whisper', from: 'T1', to: 'F1', message: 'hi' } },
    ...votes.map((v) => ({ r: 1, phase: 'vote' as const, p: v.voter, action: { target: v.target } }) as Spec),
    { r: 1, ev: { type: 'vote', stage: 'vote', votes, tally: { F3: 3 }, leaders: ['F3'] } },
    { r: 1, ev: { type: 'banishment', player: 'F3', role: 'faithful', method: 'majority' } },
  ];
  return logFrom({ ...roles }, specs);
};

describe('findHighlights', () => {
  it('ranks by score, best first, with ranks from 1', () => {
    const found = findHighlights(rich(), { name: 'game-a' });
    expect(found.map((h) => h.rank)).toEqual(found.map((_, i) => i + 1));
    expect(found.map((h) => h.rule)).toEqual(['whispers_to_night_target', 'faithful_banished_by_majority', 'final_reveal']);
    for (let i = 1; i < found.length; i++) expect(found[i - 1]!.score).toBeGreaterThanOrEqual(found[i]!.score);
  });

  it('gives each highlight a recording-mode URL that the replay page accepts', () => {
    for (const h of findHighlights(rich(), { name: 'game-a', base: 'http://example.test/play/' })) {
      const url = new URL(h.url);
      expect(url.origin + url.pathname).toBe('http://example.test/play/');
      expect(url.searchParams.get('mode')).toBe('record');
      expect(url.searchParams.get('log')).toBe('game-a');
      const parsed = parseRecordParams(url.search);
      expect(parsed).toMatchObject({ ok: true, params: { from: h.from, to: h.to, faces: null, aspect: '16x9' } });
    }
  });

  it('adds a two-faces URL only for moments about speech against notes, and honours the aspect', () => {
    const [first, , last] = findHighlights(rich(), { name: 'game-a', aspect: '9x16' });
    expect(first!.facesUrl).not.toBeNull();
    expect(parseRecordParams(new URL(first!.facesUrl!).search)).toMatchObject({ ok: true, params: { faces: first!.facesTurn, aspect: '9x16' } });
    expect(last!.facesUrl).toBeNull();
    expect(new URL(last!.url).searchParams.get('aspect')).toBe('9x16');
  });

  it('keeps only the best N with a limit', () => {
    const found = findHighlights(rich(), { name: 'game-a', limit: 2 });
    expect(found.map((h) => h.rank)).toEqual([1, 2]);
    expect(findHighlights(rich(), { name: 'game-a', limit: 0 })).toEqual([]);
  });

  it('breaks ties by the earlier moment', () => {
    const log = logFrom({ ...roles }, [
      { r: 1, phase: 'round_table', p: 'T1', action: { suspect: 'F3', reason: 'x' }, speech: 'I trust F1.', notes: 'F1 is fine.' },
      { r: 1, phase: 'round_table', p: 'T2', action: { suspect: 'F3', reason: 'x' }, speech: 'I trust F2.', notes: 'F2 is fine.' },
    ]);
    const tied = findHighlights(log, { name: 'g' }).filter((h) => h.rule === 'notes_contradict_praise');
    expect(tied.map((h) => h.from)).toEqual([0, 1]);
  });

  it('is deterministic', () => {
    expect(findHighlights(rich(), { name: 'g' })).toEqual(findHighlights(rich(), { name: 'g' }));
  });

  it('rejects a log name that is not a plain file name', () => {
    for (const bad of ['', '../x', 'a/b', 'a b', '..']) {
      expect(isValidLogName(bad), bad).toBe(false);
      expect(() => findHighlights(rich(), { name: bad })).toThrow('not a plain log name');
    }
    expect(isValidLogName('mock-seed-1')).toBe(true);
  });

  it('always has the final reveal, and every clip stays inside the game, for real mock games', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const log = await playMock(seed);
      const found = findHighlights(log, { name: `mock-seed-${seed}` });
      expect(found.some((h) => h.rule === 'final_reveal')).toBe(true);
      for (const h of found) {
        expect(h.from).toBeGreaterThanOrEqual(0);
        expect(h.to).toBeLessThan(log.turns.length);
        expect(h.from).toBeLessThanOrEqual(h.to);
        if (h.facesTurn !== null) expect(log.turns[h.facesTurn]).toBeDefined();
      }
    }
  });
});
