/** The seat named in ?seat=<name>, if it is one of the cast. A name that is not at the table is ignored. */
export function seatFromSearch(search: string, cast: readonly { name: string }[]): string | null {
  const name = new URLSearchParams(search).get('seat');
  return name !== null && cast.some((c) => c.name === name) ? name : null;
}

/** The same query with ?seat= set to `seat`, or removed when `seat` is null. Other parameters are kept as they were. */
export function searchWithSeat(search: string, seat: string | null): string {
  const q = new URLSearchParams(search);
  if (seat === null) q.delete('seat');
  else q.set('seat', seat);
  const text = q.toString();
  return text === '' ? '' : `?${text}`;
}

/** The two seats in ?seats=A,B for the split view, or null unless both are different seats at the table. */
export function splitSeatsFromSearch(search: string, cast: readonly { name: string }[]): [string, string] | null {
  const parts = (new URLSearchParams(search).get('seats') ?? '').split(',');
  if (parts.length !== 2) return null;
  const [a, b] = parts as [string, string];
  const at = (n: string): boolean => cast.some((c) => c.name === n);
  return a !== b && at(a) && at(b) ? [a, b] : null;
}

/** What the replay shows: the public 2D table, the all-seeing room (spoilers), or the room from one seat. */
export type Perspective = { kind: 'table' } | { kind: 'spectator' } | { kind: 'seat'; name: string };

/** ?seat=<name> wins over ?view=spectator; anything else is the public table. */
export function perspectiveFromSearch(search: string, cast: readonly { name: string }[]): Perspective {
  const seat = seatFromSearch(search, cast);
  if (seat !== null) return { kind: 'seat', name: seat };
  return new URLSearchParams(search).get('view') === 'spectator' ? { kind: 'spectator' } : { kind: 'table' };
}

/** The same query with the perspective set. Other parameters are kept. */
export function searchWithPerspective(search: string, p: Perspective): string {
  const q = new URLSearchParams(search);
  q.delete('seat');
  q.delete('view');
  if (p.kind === 'seat') q.set('seat', p.name);
  if (p.kind === 'spectator') q.set('view', 'spectator');
  const text = q.toString();
  return text === '' ? '' : `?${text}`;
}
