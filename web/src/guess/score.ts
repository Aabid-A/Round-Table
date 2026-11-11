import type { GameLog, Turn } from '../../../src/engine/types.js';
import { buildContext } from '../../../src/log/highlights/context.js';
import { seatsAt, buildSteps } from '../replay/timeline.js';
import type { GuessStep } from './steps.js';

export type RoundResult = 'all' | 'some' | 'none';

/** What the viewer is asked at one pick step. */
export interface PickSetup {
  round: number;
  /** Players still in the game. */
  candidates: string[];
  /** How many to pick: the traitors not yet caught, at least 1 and at most the players left. */
  count: number;
}

export interface RoundScore {
  round: number;
  picks: string[];
  /** The traitors in the game at that round table (what the viewer was trying to find). */
  traitors: string[];
  correct: number;
  possible: number;
  result: RoundResult;
}

export interface GuessScore {
  rounds: RoundScore[];
  correct: number;
  possible: number;
}

/** The pick steps, each with who can be picked and how many to pick. */
export function pickSetups(log: GameLog, steps: GuessStep[]): PickSetup[] {
  const all = buildSteps(log);
  return steps.flatMap((s) => {
    if (s.kind !== 'pick') return [];
    const seats = seatsAt(log, all, s.at);
    const candidates = seats.filter((x) => x.status === 'alive').map((x) => x.name);
    const caught = seats.filter((x) => x.status === 'banished' && x.revealedRole === 'traitor').length;
    const count = Math.max(1, Math.min(candidates.length, log.settings.traitors - caught));
    return [{ round: s.round, candidates, count }];
  });
}

/** Score the viewer's picks (round -> names). A round with no picks scores as a miss. */
export function scoreGuesses(log: GameLog, steps: GuessStep[], picks: Record<number, string[]>): GuessScore {
  const ctx = buildContext(log);
  const rounds = pickSetups(log, steps).map((setup): RoundScore => {
    const firstVote = ctx.stageTurns(setup.round, 'vote')[0];
    const turnId = firstVote?.id ?? Number.MAX_SAFE_INTEGER;
    const traitors = setup.candidates.filter((n) => ctx.isTraitorAt(n, turnId));
    const chosen = (picks[setup.round] ?? []).filter((n) => setup.candidates.includes(n));
    const correct = chosen.filter((n) => traitors.includes(n)).length;
    const possible = Math.min(setup.count, traitors.length);
    const result: RoundResult = possible > 0 && correct === possible ? 'all' : correct > 0 ? 'some' : 'none';
    return { round: setup.round, picks: chosen, traitors, correct, possible, result };
  });
  return {
    rounds,
    correct: rounds.reduce((n, r) => n + r.correct, 0),
    possible: rounds.reduce((n, r) => n + r.possible, 0),
  };
}

const SQUARE: Record<RoundResult, string> = { all: '🟩', some: '🟨', none: '⬛' };

/** One square per round: green for every traitor found, yellow for some, black for none. No names. */
export const emojiRow = (score: GuessScore): string => score.rounds.map((r) => SQUARE[r.result]).join('');

/** The text to copy: episode number, the row and the score, and the link. It names nobody and says no roles. */
export function shareText(score: GuessScore, episode: number | null, url: string): string {
  const head = episode === null ? 'Round Table' : `Round Table #${episode}`;
  return `${head} ${emojiRow(score)} ${score.correct}/${score.possible}\n${url}`;
}

export interface MissedMoment {
  round: number;
  /** A traitor the viewer did not pick in this round. */
  player: string;
  said: string;
  thought: string;
}

/** For each round the viewer did not fully get, what the traitors they missed said and privately thought. */
export function missedMoments(log: GameLog, score: GuessScore): MissedMoment[] {
  const out: MissedMoment[] = [];
  for (const r of score.rounds) {
    if (r.result === 'all') continue;
    for (const name of r.traitors.filter((n) => !r.picks.includes(n))) {
      const turn: Turn | undefined = log.turns.find((t) => t.round === r.round && t.phase === 'round_table' && t.player === name);
      if (!turn) continue;
      out.push({ round: r.round, player: name, said: turn.speech.trim() === '' ? '(said nothing)' : turn.speech, thought: turn.private_notes.trim() === '' ? 'No private notes for this turn.' : turn.private_notes });
    }
  }
  return out;
}
