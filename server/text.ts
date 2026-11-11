/** Text from a player or the host, made safe to put in a prompt, a log or a message. */

// Control characters, byte order marks and the bidirectional overrides that can reorder text on screen.
const UNSAFE = /[\p{Cc}‪-‮⁦-⁩﻿]/gu;

/**
 * One line of plain text, at most `max` characters (counted as whole characters, not UTF-16 units).
 * Line breaks and runs of spaces become one space, so a player cannot start a new line in a prompt and
 * fake a game event, a rule, or another player's turn. HTML is not touched here: the pages show text as
 * text, and React escapes it.
 */
export function cleanText(value: string, max: number): string {
  const flat = value.replace(UNSAFE, ' ').replace(/\s+/gu, ' ').trim();
  return Array.from(flat).slice(0, max).join('');
}

const MASK = '[redacted]';

/**
 * Replace every copy of each secret, as written and as it would appear inside JSON, with a mask.
 * Empty secrets are ignored (they would match everywhere).
 */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret === '') continue;
    for (const form of new Set([secret, JSON.stringify(secret).slice(1, -1)])) out = out.split(form).join(MASK);
  }
  return out;
}
