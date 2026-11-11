import { useCallback, useEffect, useState } from 'react';

/** Step index and play/pause. `durations[i]` is how long step i stays up while playing. */
export function usePlayback(durations: number[], options: { autoStart?: boolean } = {}) {
  const last = durations.length - 1;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(options.autoStart ?? false);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), durations[index]);
    return () => clearTimeout(timer);
  }, [playing, index, last, durations]);

  const seek = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, last))), [last]);
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && index >= last) setIndex(0);
      return !p;
    });
  }, [index, last]);
  const restart = useCallback(() => {
    setIndex(0);
    setPlaying(false);
  }, []);

  return { index, playing, seek, next, prev, toggle, restart };
}
