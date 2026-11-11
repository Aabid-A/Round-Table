import type { GameLog } from '../../../src/engine/types.js';
import { trustHeadline, type RoomOutcome } from '../../../src/roomResult.js';
import { foolingLine } from './outcome.js';

export interface GroupCardText {
  /** The big line: how many people trusted the traitor, or a plain title when there is nothing to say. */
  headline: string;
  /** Smaller lines under it. */
  lines: string[];
}

/** The words for the group result card. Pure, so it can be tested; the drawing is in groupCard.ts. */
export function groupCardText(log: GameLog, outcome: RoomOutcome): GroupCardText {
  const people = log.cast.filter((c) => c.model === 'human').length;
  const ais = log.cast.length - people;
  const lines = [`${people} ${people === 1 ? 'person' : 'people'} and ${ais} ${ais === 1 ? 'AI' : 'AIs'} at the table`];

  const scores = outcome.scores;
  if (scores && scores.length > 0) {
    const of = scores[0]?.of ?? 0;
    const mean = scores.reduce((sum, s) => sum + s.correct, 0) / scores.length;
    const best = scores.reduce((b, s) => (s.correct > b.correct ? s : b));
    lines.push(`Average guess: ${mean.toFixed(1)} of ${of} right. Best: ${best.person}, ${best.correct}.`);
  }
  const top = outcome.fooling?.[0];
  if (top) lines.push(top.fooled.length > 0 ? foolingLine(outcome, top) : 'Nobody was fooled.');

  return { headline: outcome.trust ? trustHeadline(outcome.trust) : 'Human or AI?', lines };
}
