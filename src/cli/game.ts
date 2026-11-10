import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { runGame } from '../engine/game.js';
import { DEFAULT_SETTINGS, type GameSettings } from '../engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../players/mock.js';
import { createOpenRouterPlayer, DEFAULT_TIMEOUT_MS } from '../players/openrouter.js';
import type { Player } from '../players/player.js';
import { buildPrompt } from '../prompts/phases.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { writeGameLog } from '../log/writer.js';
import { loadCast } from './cast.js';

function loadSettings(path: string): GameSettings {
  if (!existsSync(path)) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<GameSettings>) };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mock: { type: 'boolean', default: false },
      cast: { type: 'string' },
      seed: { type: 'string' },
      out: { type: 'string', default: 'games' },
      config: { type: 'string', default: 'config/game.json' },
      'timeout-ms': { type: 'string', default: String(DEFAULT_TIMEOUT_MS) },
    },
  });
  if (values.mock === (values.cast !== undefined)) {
    throw new Error('usage: npm run game -- --mock --seed <n>   or   npm run game -- --cast config/cast.json');
  }
  const seed = values.seed !== undefined ? Number(values.seed) : Date.now() % 2 ** 32;
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  const settings = loadSettings(values.config as string);

  let cast = MOCK_CAST;
  let players: Record<string, Player>;
  let name: string;
  if (values.mock) {
    players = createMockPlayers(cast, seed);
    name = `mock-seed-${seed}`;
  } else {
    try {
      process.loadEnvFile('.env');
    } catch {
      // No .env file: the variable may already be in the environment.
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (put it in .env or the environment)');
    cast = loadCast(values.cast as string);
    const timeoutMs = Number(values['timeout-ms']);
    players = Object.fromEntries(
      cast.map((c) => [c.name, createOpenRouterPlayer({ model: c.model, apiKey, timeoutMs })]),
    );
    name = `game-${new Date().toISOString().replace(/[:.]/g, '-')}-seed-${seed}`;
  }

  const log = await runGame({ cast, settings, seed, players, buildPrompt, systemPrompt: SYSTEM_PROMPT });
  console.log(writeGameLog(log, values.out as string, name));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
