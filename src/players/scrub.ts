import { redact } from '../redact.js';
import type { Player } from './player.js';

/**
 * Wrap fetch so the provider's reply is scrubbed before anything reads it. The OpenRouter player cuts an error body to 120
 * characters, which could leave only the front of a key that a provider echoed; a model reply that repeated the key would go into
 * later prompts. Both are masked here, while the whole key is still there to find.
 */
export function scrubbedFetch(base: typeof fetch, secrets: readonly string[]): typeof fetch {
  if (!secrets.some((s) => s !== '')) return base;
  return (async (url: string, init?: RequestInit) => {
    const res = await base(url, init);
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(redact(await res.text(), secrets), { status: res.status, statusText: res.statusText, headers });
  }) as typeof fetch;
}

/** Mask secrets in the text of anything a player throws: the engine writes it into the log and the retry prompt. */
export function redactErrors(player: Player, secrets: readonly string[]): Player {
  return {
    respond: async (req) => {
      try {
        return await player.respond(req);
      } catch (e) {
        throw new Error(redact(e instanceof Error ? e.message : String(e), secrets));
      }
    },
  };
}

/** The log with every copy of each secret masked. Parsing it back keeps the same shape. */
export function redactLog<T>(log: T, secrets: readonly string[]): T {
  return secrets.some((s) => s !== '') ? (JSON.parse(redact(JSON.stringify(log), secrets)) as T) : log;
}
