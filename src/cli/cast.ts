import { readFileSync } from 'node:fs';
import type { CastMember } from '../types.js';

export const CAST_SIZE = 8;
export const PLACEHOLDER_PREFIX = 'REPLACE-WITH';

/** Parse and validate a cast file: 8 entries of { name, model }, unique names, no placeholders. */
export function parseCast(data: unknown, source = 'cast'): CastMember[] {
  if (!Array.isArray(data) || data.length !== CAST_SIZE) throw new Error(`${source}: expected an array of ${CAST_SIZE} entries`);
  const cast = data.map((entry: unknown, i): CastMember => {
    const e = entry as { name?: unknown; model?: unknown } | null;
    if (!e || typeof e.name !== 'string' || e.name.trim() === '' || typeof e.model !== 'string' || e.model.trim() === '') {
      throw new Error(`${source}: entry ${i} needs a non-empty "name" and "model"`);
    }
    return { name: e.name, model: e.model };
  });
  if (new Set(cast.map((c) => c.name)).size !== cast.length) throw new Error(`${source}: names must be unique`);
  const placeholder = cast.find((c) => c.model.startsWith(PLACEHOLDER_PREFIX));
  if (placeholder) {
    throw new Error(`${source}: "${placeholder.name}" still has a placeholder model. Fill in real IDs from openrouter.ai/models.`);
  }
  return cast;
}

export function loadCast(path: string): CastMember[] {
  return parseCast(JSON.parse(readFileSync(path, 'utf8')), path);
}
