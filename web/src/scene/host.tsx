import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readMuted, Sound, writeMuted, type Cue } from './sound.js';
import { chooseQuality, qualityFromSearch, type Quality } from './stage/quality.js';

/**
 * What every page that shows the room needs around it: the plain page if the room cannot start, a quality level chosen from how
 * fast the first frames come, the viewer's reduced-motion setting, and sound that starts on the first click with a remembered mute.
 */

/** If the 3D room cannot load or start, show the plain version instead of a blank page. */
export class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Whether the viewer has asked their system for reduced motion, kept up to date if they change it. */
export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(query);
    const on = (): void => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function hasWebGl2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/**
 * The quality level: `?quality=` if the address sets one, otherwise high until the first 45 frames are timed, then the level they
 * point to. `onFrame` is handed to the scene, which calls it with each frame's time.
 */
export function useQualityProbe(search: string): { quality: Quality; onFrame: (ms: number) => void } {
  const fixed = qualityFromSearch(search);
  const [quality, setQuality] = useState<Quality>(fixed ?? 'high');
  const frames = useRef<number[]>([]);
  const onFrame = useCallback(
    (ms: number): void => {
      if (fixed !== null || frames.current.length >= 45) return;
      frames.current.push(ms);
      if (frames.current.length === 45) setQuality(chooseQuality(frames.current.slice(5)));
    },
    [fixed],
  );
  return { quality, onFrame };
}

/** Sound for the room: silent until `start` is called from a click or key, then cues play unless muted. The mute is remembered. */
export function useRoomSound(): { muted: boolean; start: () => void; toggleMute: () => void; play: (cue: Cue) => void } {
  const sound = useRef<Sound | null>(null);
  const [muted, setMuted] = useState(readMuted);
  const start = useCallback((): void => {
    sound.current ??= new Sound(muted);
    sound.current.start();
  }, [muted]);
  const toggleMute = useCallback((): void => {
    start();
    const m = !muted;
    setMuted(m);
    writeMuted(m);
    sound.current?.setMuted(m);
  }, [muted, start]);
  const play = useCallback((cue: Cue): void => sound.current?.play(cue), []);
  return useMemo(() => ({ muted, start, toggleMute, play }), [muted, start, toggleMute, play]);
}
