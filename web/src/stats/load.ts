import { parseStats, type StatsParse } from './parse.js';

export const isStatsPage = (search: string): boolean => new URLSearchParams(search).get('page') === 'stats';

/** ?stats=<name> picks web/public/<name>.json (plain file names only); the default is "stats". */
export function statsNameFromSearch(search: string): string {
  const name = new URLSearchParams(search).get('stats');
  return name !== null && /^[\w.-]+$/.test(name) && !name.includes('..') ? name : 'stats';
}

export async function loadStatsFromFile(file: File): Promise<StatsParse> {
  return parseStats(await file.text());
}

export async function loadStatsFromName(name: string, base: string, fetchImpl: typeof fetch = fetch): Promise<StatsParse> {
  const missing = `No ${name}.json in web/public/. Create it with npm run stats -- games/ --out web/public/${name}.json, or choose a file.`;
  let res: Response;
  try {
    res = await fetchImpl(`${base}${name}.json`);
  } catch {
    return { ok: false, message: `Could not reach ${name}.json. Check your connection and try again.` };
  }
  // Many static hosts answer a missing file with index.html and a 200.
  if (res.status === 404 || (res.ok && (res.headers.get('content-type') ?? '').includes('text/html'))) return { ok: false, message: missing };
  if (!res.ok) return { ok: false, message: `${name}.json could not be loaded (HTTP ${res.status}).` };
  return parseStats(await res.text());
}
