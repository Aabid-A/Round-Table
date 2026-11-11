import type { GuessScore, RoundResult } from './score.js';

const LABEL: Record<RoundResult, string> = { all: 'found every traitor', some: 'found some', none: 'found none' };

/** Alt text for the result card: what it says, with no names and no roles. */
export function resultCardAlt(score: GuessScore, episode: number | null): string {
  const head = episode === null ? 'Round Table' : `Round Table episode ${episode}`;
  if (score.rounds.length === 0) return `${head}. There was nothing to guess in this episode.`;
  const rounds = score.rounds.map((r) => `round ${r.round}: ${LABEL[r.result]}`).join('; ');
  return `${head}. Found ${score.correct} of ${score.possible} traitor spots. ${rounds}.`;
}
