import { existsSync, readFileSync } from 'node:fs';
import { runGame } from '../engine/game.js';
import { DEFAULT_SETTINGS, type GameLog, type GameSettings } from '../engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../players/mock.js';
import { createOpenRouterPlayer, DEFAULT_TIMEOUT_MS } from '../players/openrouter.js';
import type { Player } from '../players/player.js';
import { buildPrompt } from '../prompts/phases.js';
import { buildSystemPrompt } from '../prompts/system.js';
import type { CastMember } from '../types.js';
import { loadCast } from './cast.js';
import { scrubFetch, scrubLog, scrubPlayer } from './scrub.js';

export function loadSettings(path: string): GameSettings {
  if (!existsSync(path)) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<GameSettings>) };
}

export interface SetupOptions {
  mock: boolean;
  cast: string | undefined;
  config: string;
  timeoutMs: string | undefined;
  maxCostUsd?: string | undefined;
  costFloorUsd?: string | undefined;
  /** Injectable for tests: the fetch the real-model players use. */
  fetchImpl?: typeof fetch | undefined;
}

/** Everything that stays the same across games in one command. */
export interface Setup {
  cast: CastMember[];
  settings: GameSettings;
  makePlayers(seed: number): Record<string, Player>;
  gameName(seed: number): string;
  /** Stop each game before a call that would pass this many USD. */
  maxCostUsd?: number;
  /** What a real-model call with no reported cost counts for until a real cost has been seen in the game (USD). */
  costFloorUsd?: number;
  /** Masked in everything the real-model players report and in the finished log (the API key). */
  secrets?: string[];
}

export const USAGE = 'usage: use either --mock or --cast <path> (not both)';

export function parseMaxCost(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n) || n <= 0) throw new Error('--max-cost-usd must be a positive number');
  return n;
}

export function parseCostFloor(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n) || n <= 0) throw new Error('--cost-floor-usd must be a positive number');
  return n;
}

export function prepareSetup(opts: SetupOptions): Setup {
  const setup = buildSetup(opts);
  const maxCostUsd = parseMaxCost(opts.maxCostUsd);
  const costFloorUsd = parseCostFloor(opts.costFloorUsd);
  if (costFloorUsd !== undefined && maxCostUsd === undefined) throw new Error('--cost-floor-usd only means something with --max-cost-usd');
  return { ...setup, ...(maxCostUsd !== undefined ? { maxCostUsd } : {}), ...(costFloorUsd !== undefined ? { costFloorUsd } : {}) };
}

function buildSetup(opts: SetupOptions): Setup {
  if (opts.mock === (opts.cast !== undefined)) throw new Error(USAGE);
  const settings = loadSettings(opts.config);
  if (opts.mock) {
    return {
      cast: MOCK_CAST,
      settings,
      makePlayers: (seed) => createMockPlayers(MOCK_CAST, seed),
      gameName: (seed) => `mock-seed-${seed}`,
    };
  }
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file: the variable may already be in the environment.
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (put it in .env or the environment)');
  const cast = loadCast(opts.cast as string);
  const timeoutMs = Number(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('--timeout-ms must be a positive integer');
  const secrets = [apiKey];
  const fetchImpl = scrubFetch(opts.fetchImpl ?? fetch, secrets);
  return {
    cast,
    settings,
    secrets,
    makePlayers: () =>
      Object.fromEntries(cast.map((c) => [c.name, scrubPlayer(createOpenRouterPlayer({ model: c.model, apiKey, timeoutMs, fetchImpl }), secrets)])),
    gameName: (seed) => `game-${new Date().toISOString().replace(/[:.]/g, '-')}-seed-${seed}`,
  };
}

export async function playGame(setup: Setup, seed: number): Promise<GameLog> {
  const { cast, settings } = setup;
  const log = await runGame({
    cast,
    settings,
    seed,
    players: setup.makePlayers(seed),
    buildPrompt,
    systemPrompt: buildSystemPrompt({ players: cast.length, traitors: settings.traitors, maxRounds: settings.maxRounds }),
    ...(setup.maxCostUsd !== undefined ? { maxCostUsd: setup.maxCostUsd } : {}),
    ...(setup.costFloorUsd !== undefined ? { costFloorUsd: setup.costFloorUsd } : {}),
  });
  // Nothing that is saved may carry the key, whatever a model or provider said.
  return setup.secrets?.length ? scrubLog(log, setup.secrets) : log;
}
