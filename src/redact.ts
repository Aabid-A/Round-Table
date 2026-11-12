const MASK = '[redacted]';

/**
 * Replace every copy of each secret, as written and as it would appear inside JSON, with a mask.
 * Empty secrets are ignored (they would match everywhere).
 */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret === '') continue;
    for (const form of new Set([secret, JSON.stringify(secret).slice(1, -1)])) out = out.split(form).join(MASK);
  }
  return out;
}
