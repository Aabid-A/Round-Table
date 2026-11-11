import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { CARD_SIZES, type CardSize } from '../../web/src/card/params.js';
import { isValidLogName } from '../log/highlights/index.js';
import { readGameLog } from '../log/writer.js';
import { renderCards } from './cardRender.js';

const USAGE = 'usage: npm run card -- <log path> <turn id> [--size 1200x675|1080x1350|both] [--out .artifacts/cards] [--name NAME]';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      size: { type: 'string', default: 'both' },
      out: { type: 'string', default: '.artifacts/cards' },
      name: { type: 'string' },
    },
  });
  const [path, turnText] = positionals;
  if (!path || turnText === undefined || positionals.length > 2) throw new Error(USAGE);
  if (!/^\d{1,9}$/.test(turnText)) throw new Error('<turn id> must be a whole number (the id field of a turn in the log)');
  const turnId = Number(turnText);
  const size = values.size as string;
  if (size !== 'both' && !(CARD_SIZES as readonly string[]).includes(size)) {
    throw new Error(`--size must be ${CARD_SIZES.join(', ')} or both`);
  }
  const name = values.name ?? basename(path).replace(/\.json$/, '');
  if (!isValidLogName(name)) throw new Error(`"${name}" is not a plain log name. Pass --name with letters, digits, dot, dash or underscore.`);

  const log = readGameLog(path);
  if (!log.turns.some((t) => t.id === turnId)) throw new Error(`There is no turn ${turnId} in ${path} (turns 0 to ${log.turns.length - 1}).`);

  const sizes: readonly CardSize[] = size === 'both' ? CARD_SIZES : [size as CardSize];
  for (const file of await renderCards({ log, name, turnId, sizes, outDir: values.out as string })) console.log(file);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
