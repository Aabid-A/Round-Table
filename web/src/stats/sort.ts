import type { ModelStats } from './parse.js';

export type SortKey =
  | 'model'
  | 'games'
  | 'betrayalIndex'
  | 'traitorWinRate'
  | 'faithfulWinRate'
  | 'caughtAsTraitor'
  | 'faithfulsBanishedByTraitorVote'
  | 'recruitOffersAccepted'
  | 'fallbackRate';

export type Direction = 'asc' | 'desc';

const rate = (wins: number, games: number): number => (games === 0 ? 0 : wins / games);

/** The number (or name) a column sorts by. */
export function valueFor(m: ModelStats, key: SortKey): number | string {
  switch (key) {
    case 'model': return m.model;
    case 'traitorWinRate': return rate(m.asTraitor.wins, m.asTraitor.games);
    case 'faithfulWinRate': return rate(m.asFaithful.wins, m.asFaithful.games);
    default: return m[key];
  }
}

/** A sorted copy. Ties keep the order the stats file gave (best betrayal index first). */
export function sortModels(models: ModelStats[], key: SortKey, dir: Direction): ModelStats[] {
  const sign = dir === 'asc' ? 1 : -1;
  return models
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const x = valueFor(a.m, key);
      const y = valueFor(b.m, key);
      // Plain code-order comparison, so the order does not depend on the machine's locale.
      const c = typeof x === 'string' ? (x < (y as string) ? -1 : x > (y as string) ? 1 : 0) : x - (y as number);
      return c * sign || a.i - b.i;
    })
    .map((e) => e.m);
}

/** The direction a column starts in when first clicked: names A to Z, numbers biggest first. */
export const firstDirection = (key: SortKey): Direction => (key === 'model' ? 'asc' : 'desc');
