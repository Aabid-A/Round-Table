import { nameProblem } from '../src/cast.js';
import { normalizeCode } from '../src/roomCode.js';
import type { HumanAnswer } from '../src/players/human.js';
import type { GameLog } from '../src/engine/types.js';
import type { Phase } from '../src/types.js';
import { cleanText } from './text.js';

/** Every limit the server enforces, in one place. */
export const LIMITS = {
  /** Largest WebSocket message, in bytes. Larger ones close the connection. */
  messageBytes: 8 * 1024,
  /** Messages one connection may send per window; more are refused. */
  messagesPerWindow: 30,
  windowMs: 10_000,
  speech: 600,
  message: 300,
  note: 300,
  name: 20,
  /** A host's OpenRouter key. Real keys are far shorter. */
  key: 300,
  modelId: 100,
  /** Most dollars a room's AI seats may spend, whatever the host asks for. */
  maxCostUsd: 25,
  /** Rooms alive at once on one server. */
  rooms: 50,
  /** Connections alive at once on one server. */
  connections: 400,
  /** A room is deleted this long after it was created, finished or not. */
  roomTtlMs: 2 * 60 * 60 * 1000,
  /** How long a person has for one turn. */
  turnMs: 90_000,
} as const;

export { CODE_ALPHABET, CODE_LENGTH, normalizeCode } from '../src/roomCode.js';
export const MAX_HUMANS = 8;

// ---- client -> server ----

export type AiSetup = { mode: 'mock' } | { mode: 'openrouter'; key: string; models: string[]; maxCostUsd: number };

export type ClientMessage =
  | ({ t: 'create'; name: string; seed?: number } & AiSetup)
  | { t: 'join'; code: string; name: string }
  | { t: 'rejoin'; code: string; token: string }
  | { t: 'start' }
  | { t: 'answer'; turn: number; answer: HumanAnswer };

export type Parsed = { ok: true; msg: ClientMessage } | { ok: false; error: string };

const fail = (error: string): Parsed => ({ ok: false, error });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Check one incoming message. Anything unexpected is refused with a short reason; nothing here throws. */
export function parseClientMessage(text: string): Parsed {
  if (Buffer.byteLength(text) > LIMITS.messageBytes) return fail('That message is too long.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('Messages must be JSON.');
  }
  if (!isObject(raw) || typeof raw.t !== 'string') return fail('Messages need a type.');

  const name = (): string | { error: string } => {
    if (typeof raw.name !== 'string') return { error: 'Enter a name.' };
    const clean = cleanText(raw.name, LIMITS.name + 1);
    const problem = nameProblem(clean);
    return problem ? { error: problem } : clean;
  };

  switch (raw.t) {
    case 'create': {
      const n = name();
      if (typeof n !== 'string') return fail(n.error);
      const seed = raw.seed;
      if (seed !== undefined && !(typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed < 2 ** 31)) return fail('The seed must be a whole number.');
      const seedPart = seed === undefined ? {} : { seed: seed as number };
      if (raw.mode === 'mock') return { ok: true, msg: { t: 'create', name: n, mode: 'mock', ...seedPart } };
      if (raw.mode !== 'openrouter') return fail('Choose practice AIs or real models.');
      const key = typeof raw.key === 'string' ? raw.key.trim() : '';
      if (key === '' || key.length > LIMITS.key || /\s/.test(key)) return fail('Paste your OpenRouter key.');
      const models = Array.isArray(raw.models) ? raw.models : [];
      if (models.length === 0 || models.length > 7 || !models.every((m) => typeof m === 'string' && m.length > 0 && m.length <= LIMITS.modelId && !/\s/.test(m))) {
        return fail('Give up to 7 model IDs, such as vendor/model-name.');
      }
      const cap = raw.maxCostUsd;
      if (!(typeof cap === 'number' && Number.isFinite(cap) && cap > 0 && cap <= LIMITS.maxCostUsd)) return fail(`The spend cap must be more than 0 and at most $${LIMITS.maxCostUsd}.`);
      return { ok: true, msg: { t: 'create', name: n, mode: 'openrouter', key, models: models as string[], maxCostUsd: cap, ...seedPart } };
    }
    case 'join': {
      const code = normalizeCode(raw.code);
      if (!code) return fail('That room code does not look right.');
      const n = name();
      return typeof n === 'string' ? { ok: true, msg: { t: 'join', code, name: n } } : fail(n.error);
    }
    case 'rejoin': {
      const code = normalizeCode(raw.code);
      if (!code) return fail('That room code does not look right.');
      if (typeof raw.token !== 'string' || !/^[0-9a-f-]{36}$/.test(raw.token)) return fail('That seat token does not look right.');
      return { ok: true, msg: { t: 'rejoin', code, token: raw.token } };
    }
    case 'start':
      return { ok: true, msg: { t: 'start' } };
    case 'answer': {
      const a = raw.answer;
      if (typeof raw.turn !== 'number' || !Number.isInteger(raw.turn) || !isObject(a)) return fail('That answer is incomplete.');
      const choice = a.choice;
      if (!(choice === null || (typeof choice === 'string' && choice.length <= LIMITS.name))) return fail('That choice is not valid.');
      const text = (v: unknown, max: number): string => (typeof v === 'string' ? cleanText(v, max) : '');
      const answer: HumanAnswer = { speech: text(a.speech, LIMITS.speech), note: text(a.note, LIMITS.note), choice, message: text(a.message, LIMITS.message) };
      return { ok: true, msg: { t: 'answer', turn: raw.turn, answer } };
    }
    default:
      return fail('Unknown message type.');
  }
}

// ---- server -> client ----

export interface SeatInfo {
  name: string;
  connected: boolean;
  host: boolean;
}

export type ServerMessage =
  | { t: 'joined'; code: string; token: string; you: string; host: boolean }
  | { t: 'lobby'; code: string; mode: 'mock' | 'openrouter'; seats: SeatInfo[]; aiSeats: number; maxHumans: number }
  /** Shown to everyone while the game runs. Only the phase, never who is acting. */
  | { t: 'status'; phase: Phase | null }
  /** Private to one seat. */
  | { t: 'turn'; turn: number; phase: Phase; options: string[]; user: string; timeoutMs: number; error: string | null }
  /** Private to one seat: that turn is no longer waiting for an answer (time ran out). */
  | { t: 'turn_over'; turn: number }
  | { t: 'finished'; log: GameLog; you: string }
  | { t: 'error'; message: string }
  | { t: 'closed'; reason: string };
