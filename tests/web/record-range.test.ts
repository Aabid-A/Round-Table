import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { stepsForRange } from '../../web/src/record/range.js';
import { buildSteps } from '../../web/src/replay/timeline.js';

const log = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;
const steps = buildSteps(log);
const turnIds = (ss: typeof steps): number[] => ss.flatMap((s) => (s.kind === 'turn' ? [s.turn.id] : []));
const lastTurn = log.turns.length - 1;

describe('stepsForRange', () => {
  it('returns every step when there is no range', () => {
    expect(stepsForRange(steps, null, null)).toEqual(steps);
  });

  it('keeps the turns in from..to, inclusive, in order', () => {
    expect(turnIds(stepsForRange(steps, 10, 14))).toEqual([10, 11, 12, 13, 14]);
    expect(turnIds(stepsForRange(steps, 7, 7))).toEqual([7]);
  });

  it('keeps the events that follow those turns, and no others', () => {
    const clip = stepsForRange(steps, 10, 14);
    for (const s of clip) {
      if (s.kind !== 'event') continue;
      expect(s.event.afterTurn).toBeGreaterThanOrEqual(10);
      expect(s.event.afterTurn).toBeLessThanOrEqual(14);
    }
    const all = steps.filter((s) => s.kind === 'event' && s.event.afterTurn >= 10 && s.event.afterTurn <= 14);
    expect(clip.filter((s) => s.kind === 'event')).toEqual(all);
  });

  it('reads an open end as "to the end" and an open start as "from the start"', () => {
    const start = lastTurn - 5;
    expect(turnIds(stepsForRange(steps, start, null))[0]).toBe(start);
    expect(turnIds(stepsForRange(steps, start, null)).at(-1)).toBe(lastTurn);
    expect(turnIds(stepsForRange(steps, null, 3))).toEqual([0, 1, 2, 3]);
  });

  it('includes the result only when the clip reaches the last turn', () => {
    expect(stepsForRange(steps, 10, 14).some((s) => s.kind === 'result')).toBe(false);
    expect(stepsForRange(steps, lastTurn - 2, lastTurn).at(-1)?.kind).toBe('result');
    expect(stepsForRange(steps, lastTurn - 2, null).at(-1)?.kind).toBe('result');
  });

  it('is empty for a range past the end of the log (except an open end)', () => {
    expect(stepsForRange(steps, 500, 600)).toEqual([]);
    expect(stepsForRange(steps, 500, null)).toEqual([]);
  });

  it('keeps events that happen before the first turn when the clip has an open start', () => {
    const early = { kind: 'event', event: { type: 'breakfast', round: 1, afterTurn: -1, visibleTo: 'all', victim: null, role: null }, section: { round: 1, title: 'Breakfast' } } as const;
    const withEarly = [early, ...steps];
    expect(stepsForRange(withEarly, null, 3)[0]).toBe(early);
    expect(stepsForRange(withEarly, null, null)[0]).toBe(early);
    expect(stepsForRange(withEarly, 0, 3)[0]).not.toBe(early);
  });
});
