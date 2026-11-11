import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameLog } from '../engine/types.js';
import { readGameLog } from './writer.js';

export interface Season {
  logs: GameLog[];
  /** Files that look like logs (.json) but could not be read, with the reason. */
  skipped: { file: string; reason: string }[];
}

/** Read every .json game log in a folder (not subfolders), in file name order. Bad files are skipped, not fatal. */
export function readSeason(dir: string): Season {
  const season: Season = { logs: [], skipped: [] };
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    try {
      season.logs.push(readGameLog(join(dir, file)));
    } catch (e) {
      season.skipped.push({ file, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return season;
}
