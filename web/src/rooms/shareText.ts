import type { GameLog } from '../../../src/engine/types.js';
import type { GuessScore } from '../../../src/roomResult.js';

/**
 * A line to post about a room game that does not spoil it: how many people and AIs were at the table, how this person did at
 * guessing (when they did), and the replay link. Nothing about who won, who was a traitor, which seats were AIs, or how
 * many people trusted whom: those are what the replay is for.
 */
export function shareText(log: GameLog, myScore: GuessScore | undefined, link: string): string {
  const people = log.cast.filter((c) => c.model === 'human').length;
  const ais = log.cast.length - people;
  const table = `${people} ${people === 1 ? 'person' : 'people'} and ${ais} ${ais === 1 ? 'AI' : 'AIs'}`;
  const guess = myScore ? ` I got ${myScore.correct} of ${myScore.of} right on who was an AI.` : '';
  return `I just played Round Table: ${table}, and nobody knew which was which.${guess} Watch the replay and see if you can tell: ${link}`;
}
