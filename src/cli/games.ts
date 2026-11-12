import { parseArgs } from 'node:util';
import { DEFAULT_TIMEOUT_MS } from '../players/openrouter.js';
import { runBatch } from './batch.js';
import { costNotice } from './costNotice.js';
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
      'cost-floor-usd': { type: 'string' },
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
    costFloorUsd: values['cost-floor-usd'],
  });
  const { failed, sawCost, estimatedAttempts } = await runBatch(setup, seeds, values.out as string, console.log);
  const facts = { capped: setup.maxCostUsd !== undefined, floorUsd: setup.costFloorUsd, estimated: estimatedAttempts, sawCost };
  for (const line of costNotice(facts)) console.error(line);
  if (failed > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
