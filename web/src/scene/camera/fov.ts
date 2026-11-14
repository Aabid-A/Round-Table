import { figurePose, SEATS, tablePoint } from '../layout.js';
import { EYE_Z } from '../models/dimensions.js';

/** How far the head turns with a mouse pointer (radians each way): further in a narrow window, where less of the table is in view at once. */
export function yawArcFor(aspect: number): number {
  return aspect >= 1.2 ? 0.62 : Math.min(1.1, 0.62 + (1.2 - aspect) * 0.7);
}

/** How far a swipe can turn the head each way: just past the seats beside you. */
export const SWIPE_MAX = 1.1;

/**
 * How far down the eye rests (radians, negative is down). In a wide window it rests on the table. In a tall one it looks level, which
 * puts your hands and the table's near edge on the bottom of the screen (no floor under them) and the hall above the figures.
 */
export function restPitchFor(aspect: number): number {
  if (aspect >= 1.2) return -0.18;
  return Math.min(0.02, -0.18 + (1.2 - aspect) * 0.34);
}

/**
 * The vertical field of view. A wide window keeps about 89 degrees across. A tall window (a phone held upright) gets a closer view,
 * down to 52 degrees tall, so the table and the figures fill it; the player swipes to see the rest of the table.
 */
export function fovFor(aspect: number): number {
  const v = (2 * Math.atan(Math.tan((89 * Math.PI) / 360) / Math.max(0.2, aspect)) * 180) / Math.PI;
  const wide = Math.max(58, Math.min(74, v));
  if (aspect >= 1) return wide;
  const t = Math.min(1, (1 - aspect) / 0.4);
  return wide + (52 - wide) * t;
}

/**
 * For the vote a tall window leans in over the table: the eye rises and comes forward and looks down, so the table, the three seats
 * across it, the tokens and the names they slide to fill the picture from your hands to the top, with no empty hall above them.
 */
export const OVERVIEW = { fov: 60, pitch: -0.28, rise: 0.24, forward: 0.22 } as const;

/** The direction from the eye to seat `i` (radians, 0 straight across the table, positive to the right). */
export function bearingTo(i: number): number {
  const [x, , z] = figurePose(i).position;
  return Math.atan2(x, EYE_Z - z);
}

/** The direction from the eye to a point on the table `reach` from the middle toward seat `i`. */
export function bearingToTable(i: number, reach: number): number {
  const [x, , z] = tablePoint(i, reach);
  return Math.atan2(x, EYE_Z - z);
}

/** Where a swipe comes to rest: facing the nearest figure, so a look never ends between two seats with both cut in half. */
export function nearestStop(yaw: number, you = 0): number {
  let best = 0;
  let gap = Infinity;
  for (let i = 0; i < SEATS; i++) {
    if (i === you) continue;
    const b = bearingTo(i);
    if (Math.abs(b - yaw) < gap) [best, gap] = [b, Math.abs(b - yaw)];
  }
  return best;
}
