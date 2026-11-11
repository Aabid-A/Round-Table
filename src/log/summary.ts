import type { GameLog } from '../engine/types.js';

export function countFallbacks(log: GameLog): number {
  return log.turns.filter((t) => t.fallback).length;
}

/** One line per game: seed, winner, why it ended, rounds and fallback turns. */
export function summaryLine(log: GameLog): string {
  const r = log.result;
  const winner = r.winner === null ? 'no winner' : `${r.winner} wins`;
  return `seed ${log.seed} | ${winner} | ${r.reason} | rounds ${r.rounds} | fallbacks ${countFallbacks(log)}`;
}
