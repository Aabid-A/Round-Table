import type { GameLog } from '../engine/types.js';
import type { Player, PlayerReply } from './player.js';

/**
 * Players that return the raw replies recorded in a log, in order. Each call
 * must come from the player the log expects, or the replay throws.
 */
export function createReplayPlayers(log: GameLog): Record<string, Player> {
  const queue = log.turns.flatMap((t) => t.attempts.map((a) => ({ player: t.player, attempt: a })));
  let cursor = 0;
  return Object.fromEntries(
    log.cast.map((c) => [
      c.name,
      {
        // A player whose calls were counted as estimates was a real model: replaying it as metered makes a capped run stop where the
        // original did (with the same cap, and the same floor if one was set).
        ...(log.turns.some((t) => t.player === c.name && t.attempts.some((a) => a.costEstimatedUsd !== undefined)) ? { metered: true } : {}),
        async respond(): Promise<PlayerReply> {
          const next = queue[cursor++];
          if (!next) throw new Error(`replay: no logged reply left for ${c.name}`);
          if (next.player !== c.name) throw new Error(`replay: expected ${next.player}, got ${c.name}`);
          if (next.attempt.raw === null) throw new Error(next.attempt.error ?? 'player error');
          return next.attempt.usage ? { text: next.attempt.raw, usage: next.attempt.usage } : next.attempt.raw;
        },
      } satisfies Player,
    ]),
  );
}
