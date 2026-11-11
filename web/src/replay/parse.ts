import type { GameLog } from '../../../src/engine/types.js';

export const SUPPORTED_SCHEMA_VERSION = 1;

export type ParseOutcome = { ok: true; log: GameLog } | { ok: false; message: string };

/** Read a game log from text. Says plainly what is wrong with a file that is not a v1 log. */
export function parseGameLog(text: string): ParseOutcome {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file is not valid JSON. Choose a game log written by npm run game.' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, message: 'That file is not a game log. Choose a log written by npm run game.' };
  }
  const log = data as Partial<GameLog> & { schemaVersion?: unknown };
  if (log.schemaVersion === undefined) {
    return { ok: false, message: 'That file has no schemaVersion, so it does not look like a Round Table game log.' };
  }
  if (log.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return {
      ok: false,
      message: `This log uses schemaVersion ${JSON.stringify(log.schemaVersion)}. This viewer reads schemaVersion ${SUPPORTED_SCHEMA_VERSION}.`,
    };
  }
  if (!Array.isArray(log.cast) || !Array.isArray(log.turns) || !Array.isArray(log.events) || !log.result || !log.roles) {
    return { ok: false, message: 'This log is missing parts (cast, roles, turns, events or result). It may be cut short.' };
  }
  const problem = shapeProblem(log as GameLog);
  if (problem) return { ok: false, message: `This log looks damaged: ${problem}. It may have been edited or cut short.` };
  return { ok: true, log: log as GameLog };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The fields the viewer reads. Returns what is wrong, or null. Not a full schema check. */
function shapeProblem(log: GameLog): string | null {
  if (log.cast.length === 0) return 'the cast is empty';
  if (log.cast.some((c) => !isObj(c) || typeof c.name !== 'string' || typeof c.model !== 'string')) return 'a cast entry has no name or model';
  const t = log.turns.findIndex(
    (x) =>
      !isObj(x) ||
      typeof x.id !== 'number' ||
      typeof x.round !== 'number' ||
      typeof x.phase !== 'string' ||
      typeof x.player !== 'string' ||
      typeof x.speech !== 'string' ||
      typeof x.private_notes !== 'string' ||
      typeof x.fallback !== 'boolean' ||
      !isObj(x.action),
  );
  if (t >= 0) return `turn ${t} is missing a field`;
  const e = log.events.findIndex((x) => !isObj(x) || typeof x.type !== 'string' || typeof x.round !== 'number' || typeof x.afterTurn !== 'number');
  if (e >= 0) return `event ${e} is missing a field`;
  const r = log.result as unknown;
  if (!isObj(r) || typeof r.reason !== 'string' || typeof r.rounds !== 'number' || !('winner' in r) || !Array.isArray(r.survivors)) {
    return 'the result is missing a field';
  }
  return null;
}
