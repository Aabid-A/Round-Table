/** "1:05" for 65 seconds. Rounds up, so the clock never shows 0:00 while time is left. */
export function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Last stretch of a turn: the clock is flagged in words as well as colour. */
export const LOW_MS = 15_000;
