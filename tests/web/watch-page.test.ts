import { describe, expect, it } from 'vitest';
import type { SpectatorLog } from '../../server/protocol.js';
import { asLog, hasSomethingToShow } from '../../web/src/rooms/watch.js';
import { buildSteps } from '../../web/src/replay/timeline.js';
import { playMock } from '../helpers/game.js';

const partialOf = async (round: number): Promise<SpectatorLog> => {
  const full = await playMock(4);
  return { ...full, turns: full.turns.filter((t) => t.round <= round), events: full.events.filter((e) => e.round <= round), result: null };
};

describe('the watch page’s log', () => {
  it('has nothing to show before the first round is over, and something after', async () => {
    expect(hasSomethingToShow(await partialOf(0))).toBe(false);
    expect(hasSomethingToShow(await partialOf(1))).toBe(true);
  });

  it('is a log the replay can draw, with a placeholder result that a live watcher is never shown', async () => {
    const partial = await partialOf(1);
    const log = asLog(partial);
    expect(log.result).toMatchObject({ winner: null, survivors: [] });
    const steps = buildSteps(log, { partial: true });
    expect(steps.length).toBeGreaterThan(5);
    expect(steps.some((s) => s.kind === 'result')).toBe(false);
  });

  it('passes a finished game through untouched', async () => {
    const full = await playMock(4);
    expect(asLog(full)).toEqual(full);
  });
});
