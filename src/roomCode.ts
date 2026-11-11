export const CODE_LENGTH = 5;
/** Letters and digits that are hard to confuse when read aloud. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A room code as typed (any case, spaces around it) in its standard form, or null if it cannot be one. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}
