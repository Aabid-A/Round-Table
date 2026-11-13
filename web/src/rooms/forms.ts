import { nameProblem } from '../../../src/cast.js';
import { normalizeCode } from '../../../src/roomCode.js';

/** The most dollars a room's AI seats may spend; the server enforces the same number. */
export const MAX_COST_USD = 25;
export const MAX_MODEL_IDS = 7;

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };
const bad = (message: string): { ok: false; message: string } => ({ ok: false, message });

export interface CreateForm {
  name: string;
  real: boolean;
  key: string;
  models: string;
  cap: string;
  /** Everyone plays under an alias, so nobody knows which seats are friends and which are AIs. */
  aliases: boolean;
  /** People who are out of the game may watch every seat's view, hidden information included. */
  ghosts?: boolean;
  /** A read-only link that shows the game one full round behind. */
  spectators?: boolean;
}

/** What the page sends to make a room. The server checks it all again. */
export type CreateMessage =
  | ({ t: 'create'; name: string; mode: 'mock' } & CreateOptions)
  | ({ t: 'create'; name: string; mode: 'openrouter'; key: string; models: string[]; maxCostUsd: number } & CreateOptions);

interface CreateOptions {
  aliases?: true;
  ghosts?: true;
  spectators?: true;
}

/** One to seven model IDs, one per line or comma separated. The AI seats use them in turn. */
export function parseModelIds(text: string): Checked<string[]> {
  const ids = text.split(/[\n,]/).map((m) => m.trim()).filter((m) => m !== '');
  if (ids.length < 1 || ids.length > MAX_MODEL_IDS) return bad(`Enter 1 to ${MAX_MODEL_IDS} model IDs (one per line); you entered ${ids.length}.`);
  const withSpace = ids.find((m) => /\s/.test(m));
  return withSpace ? bad(`"${withSpace}" has a space in it; a model ID looks like vendor/model-name.`) : { ok: true, value: ids };
}

export function checkCreate(f: CreateForm): Checked<CreateMessage> {
  const problem = nameProblem(f.name);
  if (problem) return bad(problem);
  const aliases = {
    ...(f.aliases ? { aliases: true as const } : {}),
    ...(f.ghosts ? { ghosts: true as const } : {}),
    ...(f.spectators ? { spectators: true as const } : {}),
  };
  if (!f.real) return { ok: true, value: { t: 'create', name: f.name, mode: 'mock', ...aliases } };
  const key = f.key.trim();
  if (key === '' || /\s/.test(key)) return bad('Paste your OpenRouter key.');
  const models = parseModelIds(f.models);
  if (!models.ok) return models;
  const cap = Number(f.cap);
  if (!(Number.isFinite(cap) && cap > 0 && cap <= MAX_COST_USD)) return bad(`The spend cap must be above 0 and at most $${MAX_COST_USD}.`);
  return { ok: true, value: { t: 'create', name: f.name, mode: 'openrouter', key, models: models.value, maxCostUsd: cap, ...aliases } };
}

export function checkJoin(f: { code: string; name: string }): Checked<{ t: 'join'; code: string; name: string }> {
  const code = normalizeCode(f.code);
  if (!code) return bad('Enter the 5-letter room code from your friend.');
  const problem = nameProblem(f.name);
  return problem ? bad(problem) : { ok: true, value: { t: 'join', code, name: f.name } };
}
