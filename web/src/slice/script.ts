import type { GameLog } from '../../../src/engine/types.js';
import type { Role } from '../../../src/types.js';

/** The fixed mock game the slice is taken from: seed 14, where both traitors and everyone who speaks are among the seven AIs. */
export const SLICE_SEED = 14;

export interface SlicePlayer {
  /** The seat, clockwise from the player's own at 0. */
  index: number;
  name: string;
  role: Role;
}

export interface SliceSpeech {
  speaker: number;
  text: string;
  /** The seat this speaker points at. */
  suspect: number;
}

/**
 * One round table, as the slice plays it: eight seats (the player at 0 and seven AIs), what each AI says and whom they accuse, whom
 * each would vote for, and what the night brings. Built from a mock game's log so the words and the roles are the game's own.
 */
export interface SliceScript {
  players: SlicePlayer[];
  you: 0;
  /** The seven AI speeches, in the order they are heard. */
  speeches: SliceSpeech[];
  /** After how many speeches the player's turn to point comes. */
  yourTurnAfter: number;
  /** Whom each AI votes for (seat to seat), before the player's token. */
  aiVotes: Record<number, number>;
  /** The seat the log's own vote banished, used to break a tie. */
  logBanished: number;
  /** The seat that is found murdered at dawn if still at the table; otherwise the next AI. */
  logVictim: number;
}

const AI_COUNT = 7;

/** Build the script from a mock game's log. The first seven cast names sit at seats 1 to 7; the player is a faithful at seat 0. */
export function scriptFromLog(log: GameLog): SliceScript {
  const names = log.cast.slice(0, AI_COUNT).map((c) => c.name);
  const seat = (name: string): number => names.indexOf(name) + 1;
  const players: SlicePlayer[] = [
    { index: 0, name: 'You', role: 'faithful' },
    ...names.map((name, i) => ({ index: i + 1, name, role: log.roles[name] as Role })),
  ];
  const speeches: SliceSpeech[] = [];
  for (const name of names) {
    const turn = log.turns.find((t) => t.player === name && t.phase === 'round_table' && t.round === 1);
    if (!turn) throw new Error(`${name} has no round-table turn in round 1 of the slice's game`);
    const suspect = seat((turn.action as { suspect: string }).suspect);
    if (suspect < 1) throw new Error(`${name} accuses someone who is not at the slice's table`);
    speeches.push({ speaker: seat(name), text: turn.speech.trim(), suspect });
  }
  const aiVotes: Record<number, number> = {};
  for (const s of speeches) aiVotes[s.speaker] = s.suspect;
  const banishment = log.events.find((e) => e.type === 'banishment' && e.round === 1) as { player: string } | undefined;
  const victim = log.events.find((e) => e.type === 'breakfast' && e.round === 2) as { victim: string | null } | undefined;
  return {
    players,
    you: 0,
    speeches,
    yourTurnAfter: 4,
    aiVotes,
    logBanished: banishment ? Math.max(1, seat(banishment.player)) : 1,
    logVictim: victim?.victim ? Math.max(1, seat(victim.victim)) : 2,
  };
}

/** Whom the table banishes: the most votes, a tie going to the seat the log banished if it is among them, else the lowest seat. Never the player's own seat unless only it is left. */
export function banished(script: SliceScript, yourVote: number): { seat: number; tally: number[] } {
  const tally = Array.from({ length: script.players.length }, () => 0);
  for (const target of Object.values(script.aiVotes)) tally[target]!++;
  tally[yourVote]!++;
  const top = Math.max(...tally);
  const tied = tally.flatMap((n, i) => (n === top ? [i] : []));
  return { seat: tied.includes(script.logBanished) ? script.logBanished : tied[0]!, tally };
}

/** The seat found murdered at dawn: the log's victim if they are still at the table, else the next AI seat that is. Never the player. */
export function dawnVictim(script: SliceScript, banishedSeat: number): number {
  const order = Array.from({ length: AI_COUNT }, (_, i) => ((script.logVictim - 1 + i) % AI_COUNT) + 1);
  return order.find((s) => s !== banishedSeat) ?? 1;
}
