import type { Step } from '../replay/timeline.js';

/**
 * The steps of one clip: turns with id from..to (inclusive), the events that follow
 * those turns, and the result only if the clip runs to the last turn. No range means
 * the whole episode.
 */
export function stepsForRange(steps: Step[], from: number | null, to: number | null): Step[] {
  if (from === null && to === null) return steps;
  const lo = from ?? -1; // -1 keeps events that happen before the first turn
  const hi = to ?? Number.POSITIVE_INFINITY;
  const lastTurn = steps.reduce((m, s) => (s.kind === 'turn' ? Math.max(m, s.turn.id) : m), -1);
  return steps.filter((s) => {
    if (s.kind === 'turn') return s.turn.id >= lo && s.turn.id <= hi;
    if (s.kind === 'event') return s.event.afterTurn >= lo && s.event.afterTurn <= hi;
    return lo <= lastTurn && hi >= lastTurn;
  });
}
