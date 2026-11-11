import { parseEpisodeIndex, type IndexParse } from './episodes.js';

/** Read games/index.json (written by npm run episodes). A host that answers a missing file with index.html counts as missing. */
export async function loadEpisodeIndex(base: string, fetchImpl: typeof fetch = fetch): Promise<IndexParse> {
  const missing = 'No episode list yet. Create it with npm run episodes -- web/public/games (after copying logs there).';
  let res: Response;
  try {
    res = await fetchImpl(`${base}games/index.json`);
  } catch {
    return { ok: false, message: 'Could not reach the episode list. Check your connection and try again.' };
  }
  if (res.status === 404 || (res.ok && (res.headers.get('content-type') ?? '').includes('text/html'))) return { ok: false, message: missing };
  if (!res.ok) return { ok: false, message: `The episode list could not be loaded (HTTP ${res.status}).` };
  return parseEpisodeIndex(await res.text());
}
