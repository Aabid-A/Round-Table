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
