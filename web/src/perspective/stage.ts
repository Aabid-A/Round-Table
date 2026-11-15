import type { GameEvent, GameLog, Turn, VoteAction } from '../../../src/engine/types.js';
import type { SceneStage } from '../scene/view.js';
import type { Step } from '../replay/timeline.js';

/** What a viewer may see: an event, and a turn (its action). */
export interface Sight {
  event: (e: GameEvent) => boolean;
  turn: (t: Turn) => boolean;
}

/** Everything: the public replay table, which shows every step. */
export const SEES_ALL: Sight = { event: () => true, turn: () => true };

/** One seat: public events and those shown to it, and only its own turns. */
export const seatSight = (seat: string): Sight => ({ event: (e) => e.visibleTo === 'all' || e.visibleTo.includes(seat), turn: (t) => t.player === seat });

const isVote = (t: Turn): boolean => t.phase === 'vote' || t.phase === 'revote';

/** The votes of the last vote this viewer saw counted in `round`, up to the step at `index`. */
function countedVotes(steps: Step[], index: number, round: number, sight: Sight): { voter: string; target: string }[] {
  for (let i = index; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === 'event' && s.event.type === 'vote' && s.event.round === round && sight.event(s.event)) return s.event.votes;
  }
  return [];
}

/**
 * The moment the room stages for the step at `index`, as far as this viewer saw it, or null. A vote turn shows the tokens of the votes
 * of that stage the viewer saw cast so far (all of them at the public table; only the seat's own when seated).
 */
export function stageAt(log: GameLog, steps: Step[], index: number, sight: Sight): SceneStage | null {
  const step = steps[index];
  if (!step || step.kind === 'result') return null;
  if (step.kind === 'event') {
    const e = step.event;
    if (!sight.event(e)) return null;
    if (e.type === 'breakfast' && e.victim !== null) return { kind: 'dawn', victim: e.victim, role: e.role };
    if (e.type === 'banishment') return { kind: 'banish', seat: e.player, role: e.role, votes: countedVotes(steps, index, e.round, sight) };
    if (e.type === 'vote') return { kind: 'votes', votes: e.votes };
    if (e.type === 'recruit') return { kind: 'recruit', from: e.offeredBy, to: e.offeredTo };
    return null;
  }
  const t = step.turn;
  if (!isVote(t)) return null;
  const votes = log.turns
    .filter((v) => v.round === t.round && v.phase === t.phase && v.id <= t.id && sight.turn(v))
    .map((v) => ({ voter: v.player, target: (v.action as VoteAction).target }));
  return votes.length > 0 ? { kind: 'votes', votes } : null;
}
