import { parseArgs } from 'node:util';
import { DEFAULT_TIMEOUT_MS } from '../players/openrouter.js';
import { totalCostUsd } from '../log/summary.js';
import { writeGameLog } from '../log/writer.js';
import { playGame, prepareSetup } from './setup.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mock: { type: 'boolean', default: false },
      cast: { type: 'string' },
      seed: { type: 'string' },
      out: { type: 'string', default: 'games' },
      config: { type: 'string', default: 'config/game.json' },
      'max-cost-usd': { type: 'string' },
      'timeout-ms': { type: 'string', default: String(DEFAULT_TIMEOUT_MS) },
    },
  });
  const seed = values.seed !== undefined ? Number(values.seed) : Date.now() % 2 ** 32;
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
  const setup = prepareSetup({
    mock: values.mock === true,
    cast: values.cast,
    config: values.config as string,
    timeoutMs: values['timeout-ms'],
    maxCostUsd: values['max-cost-usd'],
  });
  const log = await playGame(setup, seed);
  if (setup.maxCostUsd !== undefined && totalCostUsd(log) === null) {
    console.error('warning: no cost was reported, so --max-cost-usd could not apply.');
  }
  console.log(writeGameLog(log, values.out as string, setup.gameName(seed)));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
