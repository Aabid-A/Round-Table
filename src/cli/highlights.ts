import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_BASE, findHighlights, isValidLogName } from '../log/highlights/index.js';
import { renderHighlightsJson, renderHighlightsText } from '../log/highlights/render.js';
import { readGameLog } from '../log/writer.js';

const USAGE = 'usage: npm run highlights -- <log path> [--json] [--limit N] [--base URL] [--name NAME] [--aspect 16x9|9x16]';

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      limit: { type: 'string' },
      base: { type: 'string', default: DEFAULT_BASE },
      name: { type: 'string' },
      aspect: { type: 'string' },
    },
  });
  const path = positionals[0];
  if (!path || positionals.length > 1) throw new Error(USAGE);
  const name = values.name ?? basename(path).replace(/\.json$/, '');
  if (!isValidLogName(name)) throw new Error(`"${name}" is not a plain log name. Pass --name with letters, digits, dot, dash or underscore.`);
  if (values.aspect !== undefined && values.aspect !== '16x9' && values.aspect !== '9x16') throw new Error('--aspect must be 16x9 or 9x16');
  const limit = values.limit === undefined ? undefined : Number(values.limit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) throw new Error('--limit must be a whole number, 0 or more');
  try {
    new URL(values.base as string);
  } catch {
    throw new Error('--base must be a full URL such as http://localhost:5173/');
  }

  const items = findHighlights(readGameLog(path), {
    name,
    base: values.base as string,
    ...(values.aspect ? { aspect: values.aspect as '16x9' | '9x16' } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });
  process.stdout.write(values.json ? renderHighlightsJson(items) : renderHighlightsText(items));
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
