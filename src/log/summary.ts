import type { GameLog } from '../engine/types.js';

export function countFallbacks(log: GameLog): number {
  return log.turns.filter((t) => t.fallback).length;
}

/** One line per game: seed, winner, why it ended, rounds and fallback turns. */
export function summaryLine(log: GameLog): string {
  const r = log.result;
  return `seed ${log.seed} | ${r.winner} wins | ${r.reason} | rounds ${r.rounds} | fallbacks ${countFallbacks(log)}`;
}
