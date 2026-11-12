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

/** The protocol a trusted proxy says the client used: the LAST X-Forwarded-Proto entry (the one your proxy set), lower case, or null. */
export function forwardedProto(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers['x-forwarded-proto'];
  const joined = Array.isArray(raw) ? raw.join(',') : raw;
  const last = joined?.split(',').at(-1)?.trim().toLowerCase();
  return last ? last : null;
}

/**
 * May this connection carry a host's OpenRouter key? Without a trusted proxy the server cannot tell, and does not guess (a person
 * running it on their own machine is not behind one), so yes. Behind one (`trustProxy`), only if the proxy says the client used https:
 * the key travels from the page to the server, and over plain http anyone on the way could read it.
 */
export function connectionIsSecure(headers: Record<string, string | string[] | undefined>, trustProxy: boolean): boolean {
  return !trustProxy || forwardedProto(headers) === 'https';
}
