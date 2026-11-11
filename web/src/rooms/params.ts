import { normalizeCode } from '../../../src/roomCode.js';

/** ?mode=room, or an invite link (?room=CODE), opens the rooms page. */
export const isRoomMode = (search: string): boolean => {
  const p = new URLSearchParams(search);
  return p.get('mode') === 'room' || normalizeCode(p.get('room')) !== null;
};

/** The room code in an invite link, if there is a valid one. */
export const roomCodeFromSearch = (search: string): string | null => normalizeCode(new URLSearchParams(search).get('room'));

/** ?seed=<whole number> fixes the room's game (for tests and replays of a shared setup). Without it the server picks one. */
export function roomSeedFromSearch(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('seed');
  return raw !== null && /^\d{1,9}$/.test(raw) ? Number(raw) : undefined;
}

export const DEFAULT_ROOM_PORT = 8787;

/**
 * Where the room server is. `configured` is VITE_ROOM_SERVER (a ws:// or wss:// address, set when the page is built or served);
 * otherwise port 8787 on the page's own host. It is never read from the page's address, so a link cannot point the
 * host's OpenRouter key at someone else's server.
 */
export function roomServerUrl(configured: string | undefined, loc: { protocol: string; hostname: string }): string {
  if (configured && /^wss?:\/\/[^\s/]+(:\d+)?(\/\S*)?$/.test(configured)) return configured;
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.hostname}:${DEFAULT_ROOM_PORT}`;
}

/** The link a host shares: the same page, opened on the join form with the code filled in. */
export function inviteLink(loc: { origin: string; pathname: string }, code: string): string {
  return `${loc.origin}${loc.pathname}?mode=room&room=${code}`;
}
