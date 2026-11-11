import { useCallback, useEffect, useState } from 'react';

/**
 * Step index and play/pause for the guess page. Playing stops by itself at a step that is blocked (a pick that
 * has not been locked yet), and Next will not move past one.
 */
export function useGuessPlayback(durations: number[], blocked: (index: number) => boolean) {
  const last = durations.length - 1;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const canNext = index < last && !blocked(index);

  useEffect(() => {
    if (!playing) return;
    if (!canNext) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), durations[index]);
    return () => clearTimeout(timer);
  }, [playing, canNext, index, durations]);

  const next = useCallback(() => {
    if (canNext) setIndex((i) => i + 1);
  }, [canNext]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const toggle = useCallback(() => setPlaying((p) => (canNext ? !p : false)), [canNext]);
  const restart = useCallback(() => {
    setIndex(0);
    setPlaying(false);
  }, []);
  return { index, playing, canNext, next, prev, toggle, restart };
}
