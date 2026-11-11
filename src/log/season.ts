import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameLog } from '../engine/types.js';
import { computeStats } from './stats.js';
import { readGameLog } from './writer.js';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The fields the stats read. readGameLog only checks the top-level shape. */
function statsProblem(log: GameLog): string | null {
  if (!isObj(log.roles)) return 'no roles';
  if (log.cast.some((c) => !isObj(c) || typeof c.name !== 'string' || typeof c.model !== 'string')) return 'a cast entry has no name or model';
  if (log.turns.some((t) => !isObj(t) || typeof t.player !== 'string' || typeof t.id !== 'number')) return 'a turn is missing its player or id';
  if (log.events.some((e) => !isObj(e) || typeof e.type !== 'string' || typeof e.afterTurn !== 'number' || typeof e.round !== 'number')) {
    return 'an event is missing a field';
  }
  return null;
}

export interface Season {
  logs: GameLog[];
  /** The file name of each log, without .json, in the same order as `logs`. */
  names: string[];
  /** Files that look like logs (.json) but could not be read, with the reason. */
  skipped: { file: string; reason: string }[];
}

/** Read every .json game log in a folder (not subfolders), in file name order. Bad files are skipped, not fatal. */
export function readSeason(dir: string, opts: { ignore?: string[] } = {}): Season {
  const season: Season = { logs: [], names: [], skipped: [] };
  const ignore = new Set(opts.ignore ?? []);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && !ignore.has(f)).sort()) {
    try {
      const log = readGameLog(join(dir, file));
      const problem = statsProblem(log);
      if (problem) throw new Error(`damaged log: ${problem}`);
      // The checks above cover the usual damage; a trial run catches anything else the stats would trip over.
      try {
        computeStats([log]);
      } catch (e) {
        throw new Error(`damaged log: ${e instanceof Error ? e.message : String(e)}`);
      }
      season.logs.push(log);
      season.names.push(file.replace(/\.json$/, ''));
    } catch (e) {
      season.skipped.push({ file, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return season;
}
