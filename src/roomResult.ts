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
