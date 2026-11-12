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
