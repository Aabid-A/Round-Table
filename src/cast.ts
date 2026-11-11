import type { CastMember } from './types.js';
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

