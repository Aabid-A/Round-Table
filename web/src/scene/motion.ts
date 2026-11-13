import { createContext, useContext } from 'react';

/** Whether the viewer has asked for reduced motion. The scene then swaps moves for cuts and fades and stops all idle movement. */
export const ReducedMotionContext = createContext(false);
export const useReducedMotion = (): boolean => useContext(ReducedMotionContext);

/** How much of the way to its target a thing moves this frame: eased at `rate` per second, or all at once (a cut) in reduced motion. */
export function approach(dt: number, rate: number, reduced: boolean): number {
  return reduced ? 1 : 1 - Math.exp(-dt * rate);
}

/** A value on a spring: it overshoots its target a little and settles, instead of stopping dead. */
export interface Sprung {
  x: number;
  v: number;
}

/** Move a sprung value toward `target` for one frame. Long frames are taken as 0.05 s so it cannot fly apart; in reduced motion it is simply set. */
export function spring(s: Sprung, target: number, dt: number, stiffness: number, damping: number, reduced: boolean): number {
  if (reduced) {
    s.x = target;
    s.v = 0;
    return s.x;
  }
  const step = Math.min(dt, 0.05);
  s.v += ((target - s.x) * stiffness - s.v * damping) * step;
  s.x += s.v * step;
  return s.x;
}

/** Idle movement (breathing, sway, flicker) is multiplied by this: 1, or 0 in reduced motion. */
export const idle = (reduced: boolean): number => (reduced ? 0 : 1);
