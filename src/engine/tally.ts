export interface Tally {
  counts: Record<string, number>;
  /** Everyone sharing the top count, in order of first appearance among candidates. */
  leaders: string[];
}

export function tallyVotes(votes: { target: string }[], candidates: string[]): Tally {
  const counts: Record<string, number> = {};
  for (const c of candidates) counts[c] = 0;
  for (const v of votes) counts[v.target] = (counts[v.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const leaders = candidates.filter((c) => counts[c] === top && top > 0);
  const nonZero: Record<string, number> = {};
  for (const [k, n] of Object.entries(counts)) if (n > 0) nonZero[k] = n;
  return { counts: nonZero, leaders };
}
