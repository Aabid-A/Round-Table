import type { Context } from '../../../src/log/highlights/context.js';
import type { Step } from '../replay/timeline.js';

/** Where the director points the camera for one step. */
export interface Shot {
  /** The seat to look at. Null when the shot is wide. */
  focus: string | null;
  wide: boolean;
  /** Why this shot, for tests and for anyone reading the clip's data attributes. */
  reason: 'speaker' | 'traitor_hold' | 'wide';
}

const WIDE: Shot = { focus: null, wide: true, reason: 'wide' };

/**
 * The traitor to hold on while `speaker` talks at round-table turn `turnId`: a living traitor who framed them (named them as
 * the suspect in an earlier round-table speech) or targeted them (their final night proposal). The most recent framing wins,
 * then a night target. Uses the highlight finder's context for who was a traitor and who had left the table.
 */
function traitorToHold(ctx: Context, speaker: string, turnId: number, round: number): string | null {
  const traitors = ctx.log.cast.map((c) => c.name).filter((n) => n !== speaker && ctx.isTraitorAt(n, turnId) && !ctx.isOutAt(n, turnId));
  const framed = [...ctx.log.turns]
    .reverse()
    .find((t) => t.id < turnId && t.phase === 'round_table' && traitors.includes(t.player) && (t.action as { suspect?: string }).suspect === speaker);
  if (framed) return framed.player;
  return traitors.find((t) => ctx.nightTargets(t, round).has(speaker)) ?? null;
}

/**
 * The director's camera. It cuts to whoever acts, holds on a traitor while a player they framed or targeted speaks, and pulls
 * wide for votes and reveals (banishments, breakfast, the traitors' choice, recruitments, the result).
 */
export function directorShot(ctx: Context, step: Step): Shot {
  if (step.kind !== 'turn') return WIDE;
  const t = step.turn;
  if (t.phase === 'vote' || t.phase === 'revote' || t.phase === 'endgame_vote') return WIDE;
  if (t.phase === 'round_table') {
    const hold = traitorToHold(ctx, t.player, t.id, t.round);
    if (hold) return { focus: hold, wide: false, reason: 'traitor_hold' };
  }
  return { focus: t.player, wide: false, reason: 'speaker' };
}
