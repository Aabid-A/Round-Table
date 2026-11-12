import type { GameSettings } from './types.js';
import { MAX_ATTEMPTS } from './turn.js';

/**
 * The most calls to players one game can need, worked out from the seats and the number of rounds, so a game that goes wrong
 * (a loop, a bug) cannot run on without end, whatever the calls cost.
 *
 * In one round a seat takes at most 7 turns: a night turn and a second night turn if the traitors disagree (recruiting can make
 * every other seat a traitor, so every seat counts), whispers, the round table, the vote, a revote, and the end-or-banish vote. A
 * recruitment adds 2 more turns. Each turn gets at most MAX_ATTEMPTS calls (the reply and one retry).
 * For 8 seats and 6 rounds that is (7 x 8 + 2) x 2 x 6 = 696. A normal game uses far fewer.
 */
export function maxModelCalls(settings: GameSettings, seats: number): number {
  return (7 * seats + 2) * MAX_ATTEMPTS * settings.maxRounds;
}
