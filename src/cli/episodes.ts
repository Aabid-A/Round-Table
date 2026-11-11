import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildEpisodeIndex } from '../log/episodes.js';
import { readSeason } from '../log/season.js';
import { ensureWritableDir } from '../log/writer.js';

const USAGE = 'usage: npm run episodes -- <folder of game logs> [--out <file>]   (default file: <folder>/index.json)';

function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
  const dir = positionals[0];
  if (!dir || positionals.length > 1) throw new Error(USAGE);
  const out = values.out ?? join(dir, 'index.json');

  // Read first: a missing input folder must be an error, not something the output step quietly creates.
  const season = readSeason(dir, { ignore: ['index.json'] });
  ensureWritableDir(dirname(out));
  for (const s of season.skipped) console.error(`skipped ${s.file}: ${s.reason}`);
  const { index, skipped } = buildEpisodeIndex(season.names.map((name, i) => ({ name, log: season.logs[i]! })));
  for (const name of skipped) console.error(`skipped ${name}: not a plain log name (letters, digits, dot, dash, underscore)`);
  if (index.episodes.length === 0) console.error(`warning: no game logs found in ${dir}`);

  writeFileSync(out, `${JSON.stringify(index, null, 2)}\n`);
  console.log(out);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
