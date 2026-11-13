import { createContext, useContext } from 'react';

/** Whether the viewer has asked for reduced motion. The scene then swaps moves for cuts and fades and stops all idle movement. */
export const ReducedMotionContext = createContext(false);
export const useReducedMotion = (): boolean => useContext(ReducedMotionContext);

/** How much of the way to its target a thing moves this frame: eased at `rate` per second, or all at once (a cut) in reduced motion. */
export function approach(dt: number, rate: number, reduced: boolean): number {
  return reduced ? 1 : 1 - Math.exp(-dt * rate);
}

/** Idle movement (breathing, sway, flicker) is multiplied by this: 1, or 0 in reduced motion. */
export const idle = (reduced: boolean): number => (reduced ? 0 : 1);
