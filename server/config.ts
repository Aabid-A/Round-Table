/**
 * A whole number of milliseconds from an environment variable, or `fallback` when it is unset or empty.
 * Anything else is an error, so a typo in a deploy script stops the server instead of being ignored.
 */
export function msFromEnv(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 100 || n > 24 * 60 * 60 * 1000) throw new Error(`${name} must be a whole number of milliseconds from 100 to 86400000.`);
  return n;
}

/** A whole number from `min` to `max` from an environment variable, or `fallback` when it is unset or empty. Anything else is an error. */
export function countFromEnv(env: Record<string, string | undefined>, name: string, fallback: number, min = 1, max = 100_000): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  return n;
}

/**
 * ALLOWED_ORIGINS: comma-separated origins (scheme://host or scheme://host:port, no path), such as
 * `https://play.example.org,https://example.org`. Unset or empty means no restriction. `*` is refused: write the origins you mean.
 * An origin is compared in lower case, without a trailing slash.
 */
export function parseOrigins(env: Record<string, string | undefined>): string[] | undefined {
  const raw = env.ALLOWED_ORIGINS;
  if (raw === undefined || raw.trim() === '') return undefined;
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const origin = part.trim().replace(/\/+$/, '').toLowerCase();
    if (origin === '') continue;
    if (!/^https?:\/\/[^\s/?#@]+$/.test(origin)) {
      throw new Error(`ALLOWED_ORIGINS has "${part.trim()}", which is not an origin: write scheme://host or scheme://host:port, with no path (and no *).`);
    }
    if (!out.includes(origin)) out.push(origin);
  }
  if (out.length === 0) throw new Error('ALLOWED_ORIGINS is set but holds no origin.');
  return out;
}

/**
 * Is a connection from this origin allowed? With no list, every origin is. With a list, only an origin on it: and a connection
 * with no Origin header at all is refused, since browsers always send one and only scripts and tools leave it out.
 */
export function originAllowed(origin: string | undefined, allowed: readonly string[] | undefined): boolean {
  if (allowed === undefined) return true;
  if (origin === undefined || origin === '') return false;
  return allowed.includes(origin.trim().replace(/\/+$/, '').toLowerCase());
}

/** A positive decimal number from an environment variable (such as a dollar amount), or `fallback` when unset or empty. Anything else is an error. */
export function positiveFromEnv(env: Record<string, string | undefined>, name: string, fallback: number | undefined): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a number above 0.`);
  return n;
}
