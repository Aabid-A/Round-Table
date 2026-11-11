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
  return { ok: true, log: log as GameLog };
}
