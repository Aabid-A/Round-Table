import { useEffect, useState } from 'react';
import { formatLeft, LOW_MS } from './time.js';

/** Counts down a time limit. The server owns the real clock; this only shows it. The last seconds are flagged in words as well as colour. */
export function Clock({ timeoutMs, afterText }: { timeoutMs: number; afterText: string }) {
  const [left, setLeft] = useState(timeoutMs);
  useEffect(() => {
    const end = Date.now() + timeoutMs;
    const tick = setInterval(() => setLeft(Math.max(0, end - Date.now())), 250);
    return () => clearInterval(tick);
  }, [timeoutMs]);
  const low = left <= LOW_MS;
  return (
    <p className="clock" data-low={low} data-testid="clock">
      {low ? 'Hurry: ' : ''}
      Time left <strong>{formatLeft(left)}</strong>. {afterText}
    </p>
  );
}
