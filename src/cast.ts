import type { CastMember } from './types.js';
import { createRng } from './engine/rng.js';
import { MOCK_CAST } from './players/mock.js';

/** The `model` of a seat played by a person. */
export const HUMAN_MODEL = 'human';
/** AI seats in a game played by one person. */
export const AI_SEATS = 7;

/** Words that would match unrelated notes ("You should vote...") if used as a name. */
const COMMON_WORDS = new Set(['you', 'your', 'yours', 'me', 'my', 'i', 'we', 'us', 'they', 'them', 'he', 'she', 'it', 'the', 'a', 'no', 'yes']);

export const AI_NAMES: string[] = MOCK_CAST.map((c: CastMember) => c.name);

/** A name for the human seat that is plain, short, and not one of the AI seats. Returns an error message or null. */
export function nameProblem(name: string): string | null {
  if (name !== name.trim() || name === '') return 'Enter a name, without spaces at the start or end.';
  if (name.length > 20) return 'Use 20 characters or fewer.';
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]*$/u.test(name)) return 'Use letters, numbers, spaces, apostrophes and hyphens only.';
  if (AI_NAMES.some((n) => n.toLowerCase() === name.toLowerCase())) return `${name} is already an AI's name. Choose another.`;
  if (COMMON_WORDS.has(name.toLowerCase())) return `"${name}" is an everyday word, which would match notes that are not about you. Choose a name.`;
  return null;
}

/** Seven model IDs, one per line or comma separated. Returns the list, or an error message. */
export function parseModels(text: string): { ok: true; models: string[] } | { ok: false; message: string } {
  const models = text.split(/[\n,]/).map((m) => m.trim()).filter((m) => m !== '');
  if (models.length !== AI_SEATS) return { ok: false, message: `Enter ${AI_SEATS} model IDs (one per line); you entered ${models.length}.` };
  const bad = models.find((m) => /\s/.test(m));
  if (bad) return { ok: false, message: `"${bad}" has a space in it; a model ID looks like vendor/model-name.` };
  return { ok: true, models };
}


/** Seats at the table. */
export const TABLE_SEATS = 8;

/**
 * Eight seats: the people (1 to 8, `model: "human"`) and AIs for the rest, all in an order the seed decides.
 * `models` gives the AI seats their model IDs, repeating if there are fewer IDs than seats; null means mock AIs.
 */
export function buildRoomCast(humans: string[], models: string[] | null, seed: number): CastMember[] {
  if (humans.length < 1 || humans.length > TABLE_SEATS) throw new Error(`a room seats 1 to ${TABLE_SEATS} people`);
  if (models !== null && models.length === 0) throw new Error('give at least one model ID, or none for mock AIs');
  const ai = AI_NAMES.slice(0, TABLE_SEATS - humans.length).map((name, i) => ({ name, model: models ? (models[i % models.length] as string) : 'mock' }));
  const people = humans.map((name) => ({ name, model: HUMAN_MODEL }));
  return createRng(seed).shuffle([...ai, ...people]);
}

/**
 * Alias mode: every seat, people and AIs alike, gets one of the eight AI names, and the table order is the same fixed list,
 * so a name or a position says nothing about who is a person. `people` says which alias each person got; keep it private
 * until the game is over. Model IDs are used in turn for the AI seats, as in buildRoomCast.
 */
export function buildAliasCast(humans: string[], models: string[] | null, seed: number): { cast: CastMember[]; people: Record<string, string> } {
  if (humans.length < 1 || humans.length > TABLE_SEATS) throw new Error(`a room seats 1 to ${TABLE_SEATS} people`);
  if (models !== null && models.length === 0) throw new Error('give at least one model ID, or none for mock AIs');
  const seats: (string | null)[] = createRng(seed).shuffle([...humans, ...Array<null>(TABLE_SEATS - humans.length).fill(null)]);
  let nextAi = 0;
  const cast = AI_NAMES.map((alias, i): CastMember => {
    if (seats[i] !== null) return { name: alias, model: HUMAN_MODEL };
    return { name: alias, model: models ? (models[nextAi++ % models.length] as string) : 'mock' };
  });
  const people = Object.fromEntries(AI_NAMES.flatMap((alias, i) => (seats[i] !== null ? [[alias, seats[i] as string]] : [])));
  return { cast, people };
}
