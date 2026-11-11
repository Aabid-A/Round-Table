import type { ModelStats, SeasonStats } from '../../../src/log/stats.js';

export type StatsParse = { ok: true; stats: SeasonStats } | { ok: false; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function modelProblem(m: unknown): string | null {
  if (!isObj(m) || typeof m.model !== 'string') return 'a model has no name';
  const record = (v: unknown): boolean => isObj(v) && num(v.games) && num(v.wins);
  const ok =
    num(m.games) && record(m.asTraitor) && record(m.asFaithful) && num(m.caughtAsTraitor) && num(m.faithfulsBanishedByTraitorVote) &&
    num(m.recruitOffersReceived) && num(m.recruitOffersAccepted) && num(m.turns) && num(m.fallbackTurns) && num(m.fallbackRate) && num(m.betrayalIndex);
  if (!ok) return `${m.model} is missing a number, or has a negative one`;
  return (m.fallbackRate as number) <= 1 ? null : `${m.model} has a fallback rate above 1`;
}

/** Read the stats JSON written by npm run stats. Says what is wrong with anything else. */
export function parseStats(text: string): StatsParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file is not valid JSON. Choose a file written by npm run stats.' };
  }
  if (!isObj(data) || data.statsVersion === undefined) {
    return { ok: false, message: 'That file has no statsVersion, so it does not look like season stats. Create one with npm run stats.' };
  }
  if (data.statsVersion !== 1) {
    return { ok: false, message: `These stats use statsVersion ${JSON.stringify(data.statsVersion)}. This page reads statsVersion 1.` };
  }
  if (!num(data.games) || !num(data.decidedGames) || !Array.isArray(data.models)) {
    return { ok: false, message: 'These stats are missing parts (games, decidedGames or models). The file may be cut short.' };
  }
  const seen = new Set<string>();
  for (const m of data.models) {
    const problem = modelProblem(m);
    if (problem) return { ok: false, message: `These stats look damaged: ${problem}.` };
    const name = (m as { model: string }).model;
    if (seen.has(name)) return { ok: false, message: `These stats look damaged: ${name} appears twice.` };
    seen.add(name);
  }
  return { ok: true, stats: data as unknown as SeasonStats };
}

export type { ModelStats, SeasonStats };
