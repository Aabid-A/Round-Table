import type { GameLog } from '../../../src/engine/types.js';
import { buildSteps, type Step } from '../replay/timeline.js';

/**
 * One thing the guess page shows. `at` is the index in the full replay step list (see buildSteps) that the table
 * should be drawn for: who is out, and which roles have been publicly revealed so far.
 */
export type GuessStep =
  | { kind: 'play'; step: Step; at: number }
  | { kind: 'pick'; round: number; at: number }
  | { kind: 'score'; at: number };

/** Only what every player could see: speeches, votes, breakfast, banishments. Night, whispers and recruitment are private. */
const PUBLIC_TURNS = new Set(['round_table', 'vote', 'revote', 'endgame_vote']);
const PUBLIC_EVENTS = new Set(['breakfast', 'vote', 'banishment', 'endgame_vote']);

/**
 * The episode as a guessing game. Private steps (the traitors' night, whispers, recruitment) are left out, since
 * they would give away who the traitors are. A pick step comes after each round table, before the vote, and the
 * result screen is replaced by the score.
 */
export function buildGuessSteps(log: GameLog): GuessStep[] {
  const all = buildSteps(log);
  const out: GuessStep[] = [];
  const speakers = new Set<number>(); // rounds that had a round table
  const picked = new Set<number>();
  let lastKept = 0;
  all.forEach((step, at) => {
    if (step.kind === 'result') return;
    if (step.kind === 'turn' && !PUBLIC_TURNS.has(step.turn.phase)) return;
    if (step.kind === 'event' && !PUBLIC_EVENTS.has(step.event.type)) return;
    if (step.kind === 'turn' && step.turn.phase === 'round_table') speakers.add(step.turn.round);
    if (step.kind === 'turn' && step.turn.phase === 'vote' && speakers.has(step.turn.round) && !picked.has(step.turn.round)) {
      picked.add(step.turn.round);
      out.push({ kind: 'pick', round: step.turn.round, at: lastKept });
    }
    out.push({ kind: 'play', step, at });
    lastKept = at;
  });
  out.push({ kind: 'score', at: all.length - 1 });
  return out;
}
