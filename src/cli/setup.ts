import { existsSync, readFileSync } from 'node:fs';
import { runGame } from '../engine/game.js';
import { DEFAULT_SETTINGS, type GameLog, type GameSettings } from '../engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../players/mock.js';
import { createOpenRouterPlayer, DEFAULT_TIMEOUT_MS } from '../players/openrouter.js';
import type { Player } from '../players/player.js';
import { redactErrors, scrubbedFetch } from '../players/scrub.js';
import { buildPrompt } from '../prompts/phases.js';
import { buildSystemPrompt } from '../prompts/system.js';
import type { CastMember } from '../types.js';
import { loadCast } from './cast.js';

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
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/** Everything that stays the same across games in one command. */
export interface Setup {
  cast: CastMember[];
  settings: GameSettings;
  makePlayers(seed: number): Record<string, Player>;
  gameName(seed: number): string;
  /** Stop each game before a call that would pass this many USD. */
  maxCostUsd?: number;
  /** Values that must never reach a log, a prompt or an error line (the API key). */
  secrets?: readonly string[];
}

export const USAGE = 'usage: use either --mock or --cast <path> (not both)';

export function parseMaxCost(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n) || n <= 0) throw new Error('--max-cost-usd must be a positive number');
  return n;
}

export function prepareSetup(opts: SetupOptions): Setup {
  const setup = buildSetup(opts);
  const maxCostUsd = parseMaxCost(opts.maxCostUsd);
  return maxCostUsd === undefined ? setup : { ...setup, maxCostUsd };
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
  const fetchImpl = scrubbedFetch(opts.fetchImpl ?? fetch, secrets);
  return {
    cast,
    settings,
    secrets,
    makePlayers: () =>
      Object.fromEntries(
        cast.map((c) => [c.name, createOpenRouterPlayer({ model: c.model, apiKey, timeoutMs, fetchImpl })]),
      ),
    gameName: (seed) => `game-${new Date().toISOString().replace(/[:.]/g, '-')}-seed-${seed}`,
  };
}

export function playGame(setup: Setup, seed: number): Promise<GameLog> {
  const { cast, settings } = setup;
  return runGame({
    cast,
    settings,
    seed,
    players: Object.fromEntries(
      Object.entries(setup.makePlayers(seed)).map(([name, p]) => [name, redactErrors(p, setup.secrets ?? [])]),
    ),
    buildPrompt,
    systemPrompt: buildSystemPrompt({ players: cast.length, traitors: settings.traitors, maxRounds: settings.maxRounds }),
    ...(setup.maxCostUsd !== undefined ? { maxCostUsd: setup.maxCostUsd } : {}),
  });
}
