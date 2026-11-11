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
