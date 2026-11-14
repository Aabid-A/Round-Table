import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readMuted, Sound, writeMuted, type Cue } from './sound.js';
import { chooseQuality, qualityFromSearch, tooSlow, type Quality } from './stage/quality.js';

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
 * point to. `slow` turns true if the first frames show the machine cannot show the room at all. `onFrame` is handed to the scene,
 * which calls it with each frame's time.
 */
export function useQualityProbe(search: string): { quality: Quality; onFrame: (ms: number) => void; slow: boolean } {
  const fixed = qualityFromSearch(search);
  const [quality, setQuality] = useState<Quality>(fixed ?? 'high');
  const [slow, setSlow] = useState(false);
  const frames = useRef<number[]>([]);
  const onFrame = useCallback(
    (ms: number): void => {
      if (fixed !== null || frames.current.length >= 45) return;
      frames.current.push(ms);
      // Ten frames are enough to tell a machine that cannot show the room at all (the first few, while it loads, are left out).
      if (frames.current.length === 15 && tooSlow(frames.current.slice(5))) setSlow(true);
      if (frames.current.length === 45) setQuality(chooseQuality(frames.current.slice(5)));
    },
    [fixed],
  );
  return { quality, onFrame, slow };
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

/**
 * Whether a page shows the 3D room or its plain version, and what the room needs. The plain version is shown with no WebGL, with
 * ?fallback=1, when the viewer asks for reduced motion, when the graphics context is lost, and when the first frames are too slow.
 */
export interface RoomChoice {
  room: boolean;
  quality: Quality;
  onFrame: (ms: number) => void;
  onLost: () => void;
}

export function useRoomChoice(search: string): RoomChoice {
  const { quality, onFrame, slow } = useQualityProbe(search);
  const reduced = usePrefersReducedMotion();
  const plain = useMemo(() => new URLSearchParams(search).get('fallback') === '1' || !hasWebGl2(), [search]);
  const [lost, setLost] = useState(false);
  const onLost = useCallback(() => setLost(true), []);
  return { room: !plain && !reduced && !lost && !slow, quality, onFrame, onLost };
}

/**
 * The beat of a staged banishment, counting up every `ms` from 0 while `key` names one, and back to 0 when the key changes. Stepping
 * by hand onto the moment plays it again from the start.
 */
export function useBeat(key: string | null, beats: number, ms = 1500): number {
  // The beat belongs to the key it was counted for, so a new moment starts at 0 on its very first frame.
  const [beat, setBeat] = useState({ key, n: 0 });
  useEffect(() => {
    if (key === null) return;
    let n = 0;
    setBeat({ key, n });
    const t = setInterval(() => {
      n += 1;
      setBeat({ key, n });
      if (n >= beats - 1) clearInterval(t);
    }, ms);
    return () => clearInterval(t);
  }, [key, beats, ms]);
  return beat.key === key ? beat.n : 0;
}
