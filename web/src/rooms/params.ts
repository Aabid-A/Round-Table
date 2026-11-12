import { normalizeCode, roomLogName } from '../../../src/roomCode.js';

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

/** ?mode=watch&room=CODE&k=TOKEN opens the read-only watch page. */
export const isWatchMode = (search: string): boolean => new URLSearchParams(search).get('mode') === 'watch';

/** The room code and token in a watch link, or null unless both look right. */
export function watchFromSearch(search: string): { code: string; token: string } | null {
  const q = new URLSearchParams(search);
  const code = normalizeCode(q.get('room'));
  const token = q.get('k') ?? '';
  return code !== null && /^[0-9a-f-]{36}$/.test(token) ? { code, token } : null;
}

/** The read-only link a host may share when the room has one. It shows the game one full round behind. */
export function watchLink(loc: { origin: string; pathname: string }, code: string, token: string): string {
  return `${loc.origin}${loc.pathname}?mode=watch&room=${code}&k=${token}`;
}

/** The link a host shares: the same page, opened on the join form with the code filled in. */
export function inviteLink(loc: { origin: string; pathname: string }, code: string): string {
  return `${loc.origin}${loc.pathname}?mode=room&room=${code}`;
}

/**
 * The replay link for a finished room game: the replay page opening `<room log name>`. It works where that log file has been put
 * in web/public/games/ (the room server saves it as `<LOG_DIR>/<name>.json`).
 */
export function replayLink(loc: { origin: string; pathname: string }, code: string, seed: number): string {
  return `${loc.origin}${loc.pathname}?log=${roomLogName(code, seed)}`;
}

/** The host (and port) of the room server's address, to tell a host where their key is going. If it cannot be read, the address itself. */
export function roomServerHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
