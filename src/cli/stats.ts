import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readSeason } from '../log/season.js';
import { computeStats } from '../log/stats.js';

const USAGE = 'usage: npm run stats -- <folder of game logs> [--out stats.json]';

function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
  const dir = positionals[0];
  if (!dir || positionals.length > 1) throw new Error(USAGE);

  const { logs, skipped } = readSeason(dir);
  for (const s of skipped) console.error(`skipped ${s.file}: ${s.reason}`);
  if (logs.length === 0) console.error(`warning: no game logs found in ${dir}`);

  const json = `${JSON.stringify(computeStats(logs), null, 2)}\n`;
  if (values.out) {
    writeFileSync(values.out, json);
    console.log(values.out);
  } else {
    process.stdout.write(json);
  }
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
