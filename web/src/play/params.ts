export const isPlayMode = (search: string): boolean => new URLSearchParams(search).get('mode') === 'play';

/** ?seed=<whole number> fixes the game (for tests and replays of a shared setup); otherwise a random one is used. */
export function seedFromSearch(search: string, random: () => number = Math.random): number {
  const raw = new URLSearchParams(search).get('seed');
  return raw !== null && /^\d{1,9}$/.test(raw) ? Number(raw) : Math.floor(random() * 2 ** 31);
}
