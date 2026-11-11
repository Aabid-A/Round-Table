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

export function loadSettings(path: string): GameSettings {
  if (!existsSync(path)) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<GameSettings>) };
}

export interface SetupOptions {
  mock: boolean;
  cast: string | undefined;
  config: string;
  timeoutMs: string | undefined;
}

/** Everything that stays the same across games in one command. */
export interface Setup {
  cast: CastMember[];
  settings: GameSettings;
  makePlayers(seed: number): Record<string, Player>;
  gameName(seed: number): string;
}

export const USAGE = 'usage: use either --mock or --cast <path> (not both)';

export function prepareSetup(opts: SetupOptions): Setup {
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
  return {
    cast,
    settings,
    makePlayers: () =>
      Object.fromEntries(cast.map((c) => [c.name, createOpenRouterPlayer({ model: c.model, apiKey, timeoutMs })])),
    gameName: (seed) => `game-${new Date().toISOString().replace(/[:.]/g, '-')}-seed-${seed}`,
  };
}

export function playGame(setup: Setup, seed: number): Promise<GameLog> {
  const { cast, settings } = setup;
  return runGame({
    cast,
    settings,
    seed,
    players: setup.makePlayers(seed),
    buildPrompt,
    systemPrompt: buildSystemPrompt({ players: cast.length, traitors: settings.traitors, maxRounds: settings.maxRounds }),
  });
}
