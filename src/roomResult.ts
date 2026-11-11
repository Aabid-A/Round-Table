import type { GameLog } from './engine/types.js';

/** Who is a person and who is an AI, from the log. */
export const isHumanSeat = (log: GameLog, name: string): boolean => log.cast.find((c) => c.name === name)?.model === 'human';

/** One person's answer to "which seats were AI?": the aliases they think are AIs, among the seats that were not theirs. */
export interface Guess {
  /** The person's own seat (their alias, or their name when there are no aliases). */
  seat: string;
  ai: string[];
}

export interface GuessScore {
  seat: string;
  /** Right calls out of `of` (every other seat is one call: AI or person). */
  correct: number;
  of: number;
  /** The seats this person got wrong. */
  wrong: string[];
}

/** Score each guess against the log: a seat the person called AI is right when it was an AI, and a seat they did not call AI is right when it was a person. */
export function scoreGuesses(log: GameLog, guesses: Guess[]): GuessScore[] {
  return guesses.map((g) => {
    const others = log.cast.filter((c) => c.name !== g.seat);
    const said = new Set(g.ai);
    const wrong = others.filter((c) => said.has(c.name) === isHumanSeat(log, c.name)).map((c) => c.name);
    return { seat: g.seat, correct: others.length - wrong.length, of: others.length, wrong };
  });
}

export interface Fooling {
  seat: string;
  isAi: boolean;
  /** The seats of the people who got this seat wrong. */
  fooled: string[];
}

/** Who fooled whom: for each seat, the people who called it wrongly. Most fooling first, then in seat order. */
export function whoFooledWhom(log: GameLog, scores: GuessScore[]): Fooling[] {
  const rows = log.cast.map((c, order) => ({
    order,
    seat: c.name,
    isAi: !isHumanSeat(log, c.name),
    fooled: scores.filter((s) => s.wrong.includes(c.name)).map((s) => s.seat),
  }));
  rows.sort((a, b) => b.fooled.length - a.fooled.length || a.order - b.order);
  return rows.map(({ seat, isAi, fooled }) => ({ seat, isAi, fooled }));
}

export interface TrustedTraitor {
  /** The traitor the headline is about: an AI one if any traitor was an AI, and the one who lasted longest. */
  seat: string;
  isAi: boolean;
  /** People who never voted to banish them. */
  trusted: number;
  /** People who voted at least once (someone who never got to vote could not show distrust, so is left out). */
  of: number;
}

/** The round a seat left the game (murdered or banished), or Infinity if it was still there at the end. */
function exitRound(log: GameLog, name: string): number {
  for (const e of log.events) {
    if (e.type === 'banishment' && e.player === name) return e.round;
    if (e.type === 'breakfast' && e.victim === name) return e.round;
  }
  return Infinity;
}

/** How many people trusted the traitor: the figure for the group card. Null when there is nothing to say (no people who voted). */
export function trustedTraitor(log: GameLog): TrustedTraitor | null {
  const traitors = log.cast.filter((c) => log.roles[c.name] === 'traitor');
  const ais = traitors.filter((c) => c.model !== 'human');
  const pool = ais.length > 0 ? ais : traitors;
  if (pool.length === 0) return null;
  // Longest-lasting first; a tie keeps seat order.
  const chosen = pool.reduce((best, c) => (exitRound(log, c.name) > exitRound(log, best.name) ? c : best));
  const votes = log.events.flatMap((e) => (e.type === 'vote' ? e.votes : []));
  const voters = log.cast.filter((c) => c.model === 'human' && c.name !== chosen.name && votes.some((v) => v.voter === c.name));
  if (voters.length === 0) return null;
  const distrusted = voters.filter((c) => votes.some((v) => v.voter === c.name && v.target === chosen.name)).length;
  return { seat: chosen.name, isAi: chosen.model !== 'human', trusted: voters.length - distrusted, of: voters.length };
}

/** "3 of 4 humans trusted the AI traitor". */
export function trustHeadline(t: TrustedTraitor): string {
  return `${t.trusted} of ${t.of} human${t.of === 1 ? '' : 's'} trusted the ${t.isAi ? 'AI' : 'human'} traitor`;
}
