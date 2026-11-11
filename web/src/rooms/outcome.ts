import type { Fooling, GuessScore, RoomOutcome } from '../../../src/roomResult.js';

/** "Rae", "Rae and Sam", "Rae, Sam and Tia". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The real name behind a seat: the person's own name in an alias room, and the seat name itself otherwise. */
export function personOf(outcome: RoomOutcome, seat: string): string {
  return outcome.people.find((p) => p.seat === seat)?.person ?? seat;
}

/** "Bram (an AI) fooled Quinn and Rae." or "Dax (Rae) fooled no one." The fooled seats are named by the person behind them. */
export function foolingLine(outcome: RoomOutcome, row: Fooling): string {
  const who = row.isAi ? `${row.seat} (an AI)` : outcome.people.some((p) => p.seat === row.seat) ? `${row.seat} (${personOf(outcome, row.seat)})` : row.seat;
  return row.fooled.length === 0 ? `${who} fooled no one.` : `${who} fooled ${joinNames(row.fooled.map((seat) => personOf(outcome, seat)))}.`;
}

/** "Quinn got 5 of 7 right." */
export function scoreLine(score: GuessScore & { person: string }): string {
  return `${score.person} got ${score.correct} of ${score.of} right.`;
}
