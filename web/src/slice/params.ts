/** ?mode=slice opens the vertical slice: one round table in WebGL. */
export const isSliceMode = (search: string): boolean => new URLSearchParams(search).get('mode') === 'slice';

/** ?pace=2 makes every moment last twice as long (1 to 4): more time to read, and a steady capture on a slow machine. */
export function paceFromSearch(search: string): number {
  const n = Number(new URLSearchParams(search).get('pace'));
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 1;
}
