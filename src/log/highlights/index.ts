import type { GameLog } from '../../engine/types.js';
import { buildContext } from './context.js';
import {
  defendsNightTarget,
  faithfulBannishedByMajority,
  finalReveal,
  notesContradictPraise,
  recruitAccepted,
  savesNightTargetInRevote,
  traitorVotesTraitor,
  whispersToNightTarget,
  type Rule,
} from './rules.js';
import type { Highlight, RankedHighlight } from './types.js';

export type { Highlight, RankedHighlight, RuleId } from './types.js';

export const RULES: Rule[] = [
  recruitAccepted,
  whispersToNightTarget,
  savesNightTargetInRevote,
  traitorVotesTraitor,
  notesContradictPraise,
  defendsNightTarget,
  faithfulBannishedByMajority,
  finalReveal,
];

export const DEFAULT_BASE = 'http://localhost:5173/';

export interface FindOptions {
  /** The log's name in web/public/games/ (the file name without .json). */
  name: string;
  /** Where the replay page is served. */
  base?: string;
  /** Add &aspect=9x16 to the clip URLs. */
  aspect?: '16x9' | '9x16';
  /** Keep only the best N. */
  limit?: number;
}

/** A log name is a plain file name: the same rule the replay page applies to ?log=. */
export const isValidLogName = (name: string): boolean => /^[\w.-]+$/.test(name) && !name.includes('..');

function recordUrl(base: string, name: string, params: Record<string, string | number>): string {
  const url = new URL(base);
  url.searchParams.set('mode', 'record');
  url.searchParams.set('log', name);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

/**
 * The best moments of a game, best first. Deterministic: rules only, no model calls.
 * Ties on score go to the earlier moment, then to the rule order in RULES.
 */
export function findHighlights(log: GameLog, opts: FindOptions): RankedHighlight[] {
  if (!isValidLogName(opts.name)) throw new Error(`"${opts.name}" is not a plain log name (letters, digits, dot, dash, underscore)`);
  const base = opts.base ?? DEFAULT_BASE;
  if (!/^https?:\/\//i.test(base) || !URL.canParse(base)) throw new Error('base must be a full http or https URL such as http://localhost:5173/');
  if (opts.limit !== undefined && (!Number.isInteger(opts.limit) || opts.limit < 0)) throw new Error('limit must be a whole number, 0 or more');
  const ctx = buildContext(log);
  const seen = new Set<string>();
  const all: Highlight[] = [];
  for (const rule of RULES) {
    for (const h of rule(ctx)) {
      const key = `${h.rule}|${h.title}|${h.from}|${h.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(h);
    }
  }
  // Array.prototype.sort is stable, so equal scores and starts keep the order the rules found them in.
  all.sort((a, b) => b.score - a.score || a.from - b.from);
  const extra = opts.aspect === '9x16' ? { aspect: '9x16' } : {};
  return all.slice(0, opts.limit ?? all.length).map((h, i) => ({
    ...h,
    rank: i + 1,
    url: recordUrl(base, opts.name, { ...extra, from: h.from, to: h.to }),
    facesUrl: h.facesTurn === null ? null : recordUrl(base, opts.name, { ...extra, faces: h.facesTurn }),
  }));
}
