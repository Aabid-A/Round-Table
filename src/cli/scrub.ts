import type { GameLog } from '../engine/types.js';
import type { Player } from '../players/player.js';
import { redact } from '../../server/text.js';

/**
 * A fetch whose response text has every copy of the secrets masked before anything reads it. The OpenRouter player cuts an error
 * body to 120 characters, which could leave only the front of a key that a provider echoed, so the mask has to go on while the
 * whole key is still there to find. Same approach as the room server, using the same `redact`.
 */
export function scrubFetch(inner: typeof fetch, secrets: readonly string[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const res = await inner(url, init);
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(redact(await res.text(), secrets), { status: res.status, statusText: res.statusText, headers });
  }) as typeof fetch;
}

/** The player, with the secrets masked in any error it throws (the engine writes error text into the log and the retry prompt). */
export function scrubPlayer(inner: Player, secrets: readonly string[]): Player {
  return {
    ...(inner.metered ? { metered: true } : {}),
    respond: async (req) => {
      try {
        return await inner.respond(req);
      } catch (e) {
        throw new Error(redact(e instanceof Error ? e.message : String(e), secrets));
      }
    },
  };
}

/** The log with the secrets masked everywhere, as the last step before it is written. */
export function scrubLog(log: GameLog, secrets: readonly string[]): GameLog {
  return JSON.parse(redact(JSON.stringify(log), secrets)) as GameLog;
}
