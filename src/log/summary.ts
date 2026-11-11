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

/** Total reported cost in USD, or null if no attempt reported a cost. */
export function totalCostUsd(log: GameLog): number | null {
  let total = 0;
  let seen = false;
  for (const t of log.turns) {
    for (const a of t.attempts) {
      if (a.usage?.costUsd !== undefined) {
        total += a.usage.costUsd;
        seen = true;
      }
    }
  }
  return seen ? total : null;
}

/** Attempts that reported no usable cost. A cost cap counts these as free. */
export function countUncostedAttempts(log: GameLog): number {
  return log.turns.flatMap((t) => t.attempts).filter((a) => a.usage?.costUsd === undefined).length;
}
