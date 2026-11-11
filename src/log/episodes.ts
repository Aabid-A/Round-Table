import type { GameLog } from '../engine/types.js';
import { isValidLogName } from './highlights/index.js';

export interface EpisodeEntry {
  /** 1-based, by file name order. Name files so they sort in the order you want to release them. */
  number: number;
  /** The log's name: web/public/games/<name>.json. */
  name: string;
  players: number;
  traitors: number;
  rounds: number;
}

/** A spoiler-free list of the logs the guess page can offer. It holds no winners and no roles. */
export interface EpisodeIndex {
  indexVersion: 1;
  episodes: EpisodeEntry[];
}

/** Build the index from logs and their names (already in release order). Logs with an unusable name are left out. */
export function buildEpisodeIndex(items: { name: string; log: GameLog }[]): { index: EpisodeIndex; skipped: string[] } {
  const skipped: string[] = [];
  const episodes: EpisodeEntry[] = [];
  for (const { name, log } of items) {
    if (!isValidLogName(name)) {
      skipped.push(name);
      continue;
    }
    episodes.push({
      number: episodes.length + 1,
      name,
      players: log.cast.length,
      traitors: log.settings.traitors,
      rounds: log.result.rounds,
    });
  }
  return { index: { indexVersion: 1, episodes }, skipped };
}
