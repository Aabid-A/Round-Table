import type { GameLog } from '../engine/types.js';
import { buildContext } from './highlights/context.js';

export interface RoleRecord {
  games: number;
  wins: number;
}

export interface ModelStats {
  model: string;
  /** Seats played. A model that holds two seats in one game counts twice. */
  games: number;
  /** Games the model played as a traitor (a recruit counts as a traitor), among games with a winner. */
  asTraitor: RoleRecord;
  asFaithful: RoleRecord;
  /** Times the model was banished while a traitor. */
  caughtAsTraitor: number;
  /** Banishments of a faithful where the model, then a traitor, voted for that faithful in the deciding vote. */
  faithfulsBanishedByTraitorVote: number;
  /** Recruitment offers the model received as a faithful, and how many it accepted. */
  recruitOffersReceived: number;
  recruitOffersAccepted: number;
  turns: number;
  fallbackTurns: number;
  /** fallbackTurns / turns, 0 to 1, 3 decimals (0 when there are no turns). */
  fallbackRate: number;
  /** (wins as a traitor + faithfuls banished by its traitor vote + recruit offers accepted) / games, 2 decimals. */
  betrayalIndex: number;
}

export interface SeasonStats {
  statsVersion: 1;
  games: number;
  /** Games that ended with a winner (not stopped by a cost cap). */
  decidedGames: number;
  /** Best betrayal index first; then more games; then model name. */
  models: ModelStats[];
}

const blank = (model: string): ModelStats => ({
  model,
  games: 0,
  asTraitor: { games: 0, wins: 0 },
  asFaithful: { games: 0, wins: 0 },
  caughtAsTraitor: 0,
  faithfulsBanishedByTraitorVote: 0,
  recruitOffersReceived: 0,
  recruitOffersAccepted: 0,
  turns: 0,
  fallbackTurns: 0,
  fallbackRate: 0,
  betrayalIndex: 0,
});

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Add one game to the running totals. */
function addGame(byModel: Map<string, ModelStats>, log: GameLog): void {
  const modelOf = new Map(log.cast.map((c) => [c.name, c.model]));
  const stat = (player: string): ModelStats | undefined => {
    const model = modelOf.get(player);
    if (model === undefined) return undefined;
    let s = byModel.get(model);
    if (!s) byModel.set(model, (s = blank(model)));
    return s;
  };
  const ctx = buildContext(log);
  const winner = log.result.winner;

  for (const c of log.cast) {
    const s = stat(c.name)!;
    s.games++;
    if (winner === null) continue;
    // The role at the end of the game: a recruit who accepted finishes as a traitor.
    const role = ctx.isTraitorAt(c.name, Number.MAX_SAFE_INTEGER) ? 'traitor' : 'faithful';
    const record = role === 'traitor' ? s.asTraitor : s.asFaithful;
    record.games++;
    if (winner === role) record.wins++;
  }

  for (const t of log.turns) {
    const s = stat(t.player);
    if (!s) continue;
    s.turns++;
    if (t.fallback) s.fallbackTurns++;
  }

  for (const e of ctx.events('banishment')) {
    if (e.role === 'traitor') {
      const s = stat(e.player);
      if (s) s.caughtAsTraitor++;
      continue;
    }
    const decisive = [...ctx.events('vote')].reverse().find((v) => v.round === e.round && v.afterTurn <= e.afterTurn);
    for (const v of decisive?.votes ?? []) {
      if (v.target === e.player && ctx.isTraitorAt(v.voter, e.afterTurn)) {
        const s = stat(v.voter);
        if (s) s.faithfulsBanishedByTraitorVote++;
      }
    }
  }

  for (const e of ctx.events('recruit')) {
    const s = stat(e.offeredTo);
    if (!s) continue;
    s.recruitOffersReceived++;
    if (e.accepted) s.recruitOffersAccepted++;
  }
}

/** Totals per model over a season of games. Pure: the same logs always give the same numbers. */
export function computeStats(logs: GameLog[]): SeasonStats {
  const byModel = new Map<string, ModelStats>();
  for (const log of logs) addGame(byModel, log);
  const models = [...byModel.values()].map((s) => ({
    ...s,
    fallbackRate: s.turns === 0 ? 0 : round3(s.fallbackTurns / s.turns),
    betrayalIndex: s.games === 0 ? 0 : round2((s.asTraitor.wins + s.faithfulsBanishedByTraitorVote + s.recruitOffersAccepted) / s.games),
  }));
  models.sort((a, b) => b.betrayalIndex - a.betrayalIndex || b.games - a.games || a.model.localeCompare(b.model));
  return {
    statsVersion: 1,
    games: logs.length,
    decidedGames: logs.filter((l) => l.result.winner !== null).length,
    models,
  };
}
