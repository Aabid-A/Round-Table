import { runGame } from '../../../src/engine/game.js';
import { DEFAULT_SETTINGS, type GameLog } from '../../../src/engine/types.js';
import { AI_NAMES, AI_SEATS, HUMAN_MODEL, nameProblem, parseModels } from '../../../src/cast.js';
import { createMockPlayers } from '../../../src/players/mock.js';
import { createOpenRouterPlayer } from '../../../src/players/openrouter.js';
import type { Player } from '../../../src/players/player.js';
import { buildPrompt } from '../../../src/prompts/phases.js';
import { buildSystemPrompt } from '../../../src/prompts/system.js';
import type { CastMember } from '../../../src/types.js';
import { createHumanPlayer, type HumanAnswer } from './human.js';
import type { PromptRequest } from '../../../src/players/player.js';
import { publicPhase, type PublicPhase } from '../../../src/publicPhase.js';

export { AI_SEATS, HUMAN_MODEL, nameProblem, parseModels };

export type AiSetup =
  | { kind: 'mock' }
  /** Real models through OpenRouter. The key is used for the requests and kept nowhere else. */
  | { kind: 'openrouter'; apiKey: string; models: string[] };

export interface SoloSetup {
  humanName: string;
  seed: number;
  ai: AiSetup;
  /** Stop the game before a call that could pass this many USD (real models only report costs). */
  maxCostUsd?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/** Eight seats: seven AIs and the human, whose seat position comes from the seed. */
export function buildSoloCast(humanName: string, models: string[] | null, seed: number): CastMember[] {
  const ai = AI_NAMES.slice(0, AI_SEATS).map((name, i) => ({ name, model: models?.[i] ?? 'mock' }));
  const at = Math.abs(seed) % (AI_SEATS + 1);
  return [...ai.slice(0, at), { name: humanName, model: HUMAN_MODEL }, ...ai.slice(at)];
}

/**
 * Play one game in this tab: the engine, the prompts and the AI players are the same code the command line uses.
 * `ask` is how the human's turns reach a form. Returns the finished log.
 */
export async function runSolo(
  setup: SoloSetup,
  ask: (req: PromptRequest) => Promise<HumanAnswer>,
  /** Aborting stops all network calls at once and lets the game wind down locally; the result is then not worth keeping. */
  signal?: AbortSignal,
  /** Told the phase everyone at the table is told of, each time it changes: what a room would announce. Never who is acting. */
  onPhase?: (phase: PublicPhase) => void,
): Promise<GameLog> {
  const problem = nameProblem(setup.humanName);
  if (problem) throw new Error(problem);
  if (setup.maxCostUsd !== undefined && !(Number.isFinite(setup.maxCostUsd) && setup.maxCostUsd > 0)) throw new Error('The spend cap must be a positive number.');
  const models = setup.ai.kind === 'openrouter' ? setup.ai.models : null;
  if (setup.ai.kind === 'openrouter' && (setup.ai.apiKey.trim() === '' || models!.length !== AI_SEATS)) throw new Error(`Real models need a key and ${AI_SEATS} model IDs.`);
  const cast = buildSoloCast(setup.humanName, models, setup.seed);

  const aiCast = cast.filter((c) => c.model !== HUMAN_MODEL);
  const baseFetch = setup.fetchImpl ?? fetch;
  // A request in flight is cancelled by the same signal that stops new ones.
  const fetchImpl: typeof fetch = signal
    ? ((url: string, init?: RequestInit) =>
        baseFetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal })) as typeof fetch
    : baseFetch;
  const players: Record<string, Player> =
    setup.ai.kind === 'mock'
      ? createMockPlayers(aiCast, setup.seed)
      : Object.fromEntries(
          aiCast.map((c) => [c.name, createOpenRouterPlayer({ model: c.model, apiKey: (setup.ai as { apiKey: string }).apiKey.trim(), fetchImpl })]),
        );
  players[setup.humanName] = createHumanPlayer(ask);
  if (signal || onPhase) {
    let announced: PublicPhase | null = null;
    // Once aborted, every turn fails at once without touching the network, so the game ends in a moment.
    for (const [name, inner] of Object.entries(players)) {
      players[name] = {
        // Keep the flag: it is what makes the spend cap count a real-model call that returns no cost.
        ...(inner.metered ? { metered: true } : {}),
        respond: async (req) => {
          if (signal?.aborted) throw new Error('The game was ended.');
          const label = publicPhase(req.phase);
          if (onPhase && label !== announced) onPhase((announced = label));
          return inner.respond(req);
        },
      };
    }
  }

  const settings = DEFAULT_SETTINGS;
  return runGame({
    cast,
    settings,
    seed: setup.seed,
    players,
    buildPrompt,
    systemPrompt: buildSystemPrompt({ players: cast.length, traitors: settings.traitors, maxRounds: settings.maxRounds }),
    ...(setup.maxCostUsd !== undefined ? { maxCostUsd: setup.maxCostUsd } : {}),
  });
}
