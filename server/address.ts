/**
 * Where a connection came from. By default the socket's own address. With `trustProxy` (only when a reverse proxy you run sits in front,
 * and it is the only one), the LAST X-Forwarded-For entry: that is the one your proxy added, while earlier entries are whatever the
 * client chose to send and can be made up.
 */
export function addressOf(headers: Record<string, string | string[] | undefined>, remote: string | undefined, trustProxy: boolean): string | null {
  if (trustProxy) {
    const raw = headers['x-forwarded-for'];
    const joined = Array.isArray(raw) ? raw.join(',') : raw;
    const last = joined?.split(',').at(-1)?.trim();
    if (last) return last;
  }
  return remote ?? null;
}
