import type { EpisodeEntry, EpisodeIndex } from '../../../src/log/episodes.js';
import type { EpisodeSelector } from './params.js';

export type IndexParse = { ok: true; index: EpisodeIndex } | { ok: false; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Read web/public/games/index.json, written by npm run episodes. */
export function parseEpisodeIndex(text: string): IndexParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'The episode list is not valid JSON. Create it with npm run episodes -- web/public/games.' };
  }
  if (!isObj(data) || data.indexVersion !== 1 || !Array.isArray(data.episodes)) {
    return { ok: false, message: 'The episode list is not in the expected format (indexVersion 1). Create it with npm run episodes -- web/public/games.' };
  }
  const names = new Set<string>();
  for (const e of data.episodes) {
    const ok = isObj(e) && Number.isInteger(e.number) && typeof e.name === 'string' && /^[\w.-]+$/.test(e.name) && !e.name.includes('..') && Number.isInteger(e.players) && Number.isInteger(e.rounds);
    if (!ok) return { ok: false, message: 'The episode list looks damaged: an episode is missing a field or has an unusable name.' };
    if (names.has((e as { name: string }).name)) return { ok: false, message: `The episode list looks damaged: ${(e as { name: string }).name} appears twice.` };
    names.add((e as { name: string }).name);
  }
  return { ok: true, index: data as unknown as EpisodeIndex };
}

/** Whole days since 1970-01-01 (UTC) for a date, so everyone, wherever they are, gets the same day. */
export const dayNumber = (date: Date): number => Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);

/**
 * The episode to play. "today" picks by UTC date, cycling through the list, so everyone plays the same game that
 * day. A number picks that episode. Null if there is no such episode.
 */
export function pickEpisode(index: EpisodeIndex, selector: EpisodeSelector, today: Date): EpisodeEntry | null {
  const list = index.episodes;
  if (list.length === 0) return null;
  if (selector.kind === 'number') return list.find((e) => e.number === selector.number) ?? null;
  return list[((dayNumber(today) % list.length) + list.length) % list.length] ?? null;
}
