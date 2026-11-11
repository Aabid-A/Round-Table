import type { GameLog } from '../../src/engine/types.js';
import { parseGameLog } from './replay/parse.js';

export type LoadResult = { ok: true; log: GameLog } | { ok: false; message: string };

/** The ?log=<name> value: letters, digits, dot, dash and underscore only, so it stays inside web/public/games/. */
export function logNameFromSearch(search: string): string | null {
  const name = new URLSearchParams(search).get('log');
  return name !== null && /^[\w.-]+$/.test(name) && !name.includes('..') ? name : null;
}

export async function loadFromFile(file: File): Promise<LoadResult> {
  return parseGameLog(await file.text());
}

export async function loadFromName(name: string, base: string, fetchImpl: typeof fetch = fetch): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${base}games/${name}.json`);
  } catch {
    return { ok: false, message: `Could not reach the log "${name}". Check your connection and try again.` };
  }
  // Many static hosts answer a missing file with the app's index.html and a 200, so treat HTML as "not found".
  const html = (res.headers.get('content-type') ?? '').includes('text/html');
  if (res.status === 404 || (res.ok && html)) {
    return { ok: false, message: `No log named "${name}" in web/public/games/. Copy a log there, or choose a file instead.` };
  }
  if (!res.ok) return { ok: false, message: `The log "${name}" could not be loaded (HTTP ${res.status}).` };
  return parseGameLog(await res.text());
}
