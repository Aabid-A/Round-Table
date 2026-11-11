import { parseArgs } from 'node:util';
import { DEFAULT_TIMEOUT_MS } from '../players/openrouter.js';
import { runBatch } from './batch.js';
import { parseSeeds } from './seeds.js';
import { prepareSetup } from './setup.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mock: { type: 'boolean', default: false },
      cast: { type: 'string' },
      seeds: { type: 'string' },
      out: { type: 'string', default: 'games' },
      config: { type: 'string', default: 'config/game.json' },
      'max-cost-usd': { type: 'string' },
      'timeout-ms': { type: 'string', default: String(DEFAULT_TIMEOUT_MS) },
    },
  });
  if (values.seeds === undefined) throw new Error('usage: npm run games -- --mock --seeds 1-20');
  const seeds = parseSeeds(values.seeds);
  const setup = prepareSetup({
    mock: values.mock === true,
    cast: values.cast,
    config: values.config as string,
    timeoutMs: values['timeout-ms'],
    maxCostUsd: values['max-cost-usd'],
  });
  const { failed, sawCost, uncostedAttempts } = await runBatch(setup, seeds, values.out as string, console.log);
  if (setup.maxCostUsd !== undefined) {
    if (!sawCost) console.error('warning: no cost was reported, so --max-cost-usd could not apply.');
    else if (uncostedAttempts > 0) {
      console.error(`warning: ${uncostedAttempts} attempts reported no cost; --max-cost-usd counted them as free.`);
    }
  }
  if (failed > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
