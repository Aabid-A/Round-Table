import { buildRoomCast } from '../src/cast.js';
import { runGame } from '../src/engine/game.js';
import { DEFAULT_SETTINGS, type GameLog } from '../src/engine/types.js';
import { createMockPlayers } from '../src/players/mock.js';
import { createOpenRouterPlayer } from '../src/players/openrouter.js';
import type { Player } from '../src/players/player.js';
import { buildPrompt } from '../src/prompts/phases.js';
import { buildSystemPrompt } from '../src/prompts/system.js';
import { HUMAN_MODEL } from '../src/cast.js';
import { publicPhase } from '../src/publicPhase.js';
import type { Room } from './room.js';
import type { SeatPlayer } from './seatPlayer.js';
import { redact } from './text.js';

export interface RunRoomOptions {
  /** One SeatPlayer per person in the room, by name. */
  seatPlayers: ReadonlyMap<string, SeatPlayer>;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** How long one AI call may take. */
  aiTimeoutMs?: number;
  /** Aborting cancels AI calls in flight and fails every later turn at once, so a closed room stops spending. */
  signal?: AbortSignal;
}

/**
 * Play a room's game: the engine, prompts and AI players are the code the command line uses, with the people's seats
 * answered over their connections. Everyone sees only the phase while it runs; the full log comes back at the end.
 * The host's key is used for the AI requests, scrubbed from every error text, and forgotten when the game ends.
 */
export async function runRoomGame(room: Room, opts: RunRoomOptions): Promise<GameLog> {
  const setup = room.takeSetup();
  const secrets = setup.mode === 'openrouter' ? [setup.key] : [];
  const cast = buildRoomCast(
    room.seats.map((s) => s.name),
    setup.mode === 'openrouter' ? setup.models : null,
    room.seed,
  );
  const aiCast = cast.filter((c) => c.model !== HUMAN_MODEL);

  const { signal } = opts;
  const baseFetch = opts.fetchImpl ?? fetch;
  const fetchImpl: typeof fetch = signal
    ? ((url: string, init?: RequestInit) => baseFetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal })) as typeof fetch
    : baseFetch;
  // Scrub what the provider sends back before anything reads it. The OpenRouter player cuts an error body to 120 characters, which could
  // leave only the front of a key that a provider echoed; a model reply that repeated the key would go into later prompts. Both
  // are masked here, while the whole key is still there to find.
  const scrubbedFetch: typeof fetch = secrets.length
    ? ((async (url: string, init?: RequestInit) => {
        const res = await fetchImpl(url, init);
        const headers = new Headers(res.headers);
        headers.delete('content-length');
        headers.delete('content-encoding');
        return new Response(redact(await res.text(), secrets), { status: res.status, statusText: res.statusText, headers });
      }) as typeof fetch)
    : fetchImpl;
  const base: Record<string, Player> =
    setup.mode === 'mock'
      ? createMockPlayers(aiCast, room.seed)
      : Object.fromEntries(
          aiCast.map((c) => [
            c.name,
            createOpenRouterPlayer({
              model: c.model,
              apiKey: setup.key,
              fetchImpl: scrubbedFetch,
              ...(opts.aiTimeoutMs !== undefined ? { timeoutMs: opts.aiTimeoutMs } : {}),
            }),
          ]),
        );
  for (const c of cast) {
    if (c.model !== HUMAN_MODEL) continue;
    const seat = opts.seatPlayers.get(c.name);
    if (!seat) throw new Error(`no connection handler for ${c.name}`);
    base[c.name] = seat.player;
  }

  const players: Record<string, Player> = {};
  // Tell everyone the phase only when it changes. One status per turn would show how many turns a phase took, and so how many
  // traitors are alive, whether they disagreed, and whether a recruit offer was made.
  for (const [name, inner] of Object.entries(base)) {
    players[name] = {
      respond: async (req) => {
        if (signal?.aborted) throw new Error('the room closed');
        const label = publicPhase(req.phase);
        if (label !== room.status) room.announce(label);
        try {
          return await inner.respond(req);
        } catch (e) {
          // The engine writes error text into the log and into the retry prompt. A provider can echo a key back.
          throw new Error(redact(e instanceof Error ? e.message : String(e), secrets));
        }
      },
    };
  }

  try {
    const log = await runGame({
      cast,
      settings: DEFAULT_SETTINGS,
      seed: room.seed,
      players,
      buildPrompt,
      systemPrompt: buildSystemPrompt({ players: cast.length, traitors: DEFAULT_SETTINGS.traitors, maxRounds: DEFAULT_SETTINGS.maxRounds }),
      ...(setup.mode === 'openrouter' ? { maxCostUsd: setup.maxCostUsd } : {}),
    });
    // Belt and braces: nothing that leaves the server may carry the key, whatever a model or provider said.
    return secrets.length ? (JSON.parse(redact(JSON.stringify(log), secrets)) as GameLog) : log;
  } finally {
    room.dropKey();
  }
}
