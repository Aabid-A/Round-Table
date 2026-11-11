export type EpisodeSelector = { kind: 'today' } | { kind: 'number'; number: number };

export interface GuessParams {
  /** A log to play directly, by name. Wins over `episode`. */
  log: string | null;
  /** An episode to look up in the index: today's, or a number. */
  episode: EpisodeSelector | null;
  /** The episode number to put on a shared result when playing a log directly. */
  label: number | null;
  /** Pretend today is this date (YYYY-MM-DD), so a test or a preview can pick the day's episode. */
  date: string | null;
}

export type GuessParse = { ok: true; params: GuessParams } | { ok: false; message: string };

export const isGuessMode = (search: string): boolean => new URLSearchParams(search).get('mode') === 'guess';
export const isEpisodesPage = (search: string): boolean => new URLSearchParams(search).get('page') === 'episodes';

const PLAIN = /^[\w.-]+$/;

/** Read ?mode=guess&log=<name> or &episode=today|<n> (and &date=YYYY-MM-DD). Says which parameter is wrong. */
export function parseGuessParams(search: string): GuessParse {
  const q = new URLSearchParams(search);
  const log = q.get('log');
  if (log !== null && (!PLAIN.test(log) || log.includes('..'))) return { ok: false, message: 'log must be a plain file name (letters, digits, dot, dash, underscore).' };
  const ep = q.get('episode');
  let episode: EpisodeSelector | null = null;
  let label: number | null = null;
  if (ep !== null) {
    if (ep === 'today') episode = { kind: 'today' };
    else if (/^[1-9]\d{0,5}$/.test(ep)) {
      episode = { kind: 'number', number: Number(ep) };
      label = Number(ep);
    } else return { ok: false, message: 'episode must be "today" or an episode number (1 or more).' };
  }
  const date = q.get('date');
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'date must look like 2026-11-11.' };
  if (date !== null && Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, message: 'date is not a real date.' };
  return { ok: true, params: { log, episode, label: log !== null ? label : null, date } };
}
