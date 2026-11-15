import { figurePose, seatAngle } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { TABLE_Y } from '../models/dimensions.js';

export interface Shot {
  position: [number, number, number];
  target: [number, number, number];
  /** How far the shot drifts in toward its target while it is held, as a part of the distance (a slow push-in). */
  push: number;
}

/** The whole table from high on one side: for votes, reveals, and when no one holds the moment. */
// High and between two seats, so no figure's hood stands in the middle of the picture.
export const WIDE: Shot = { position: [Math.sin(-Math.PI / 8) * 4.4, 4.3, Math.cos(-Math.PI / 8) * 4.4], target: [0, TABLE_Y, 0], push: 0.04 };

/**
 * A shot of the seat `focus` from across the table: over the shoulder of the figure opposite, a little to one side and above, looking
 * at the speaker's mask. Held, it pushes in slowly (see /art-direction, Camera).
 */
export function shotOf(focus: number): Shot {
  const a = seatAngle(focus) + Math.PI + 0.32;
  const r = 3.55;
  const [fx, , fz] = figurePose(focus).position;
  return { position: [Math.sin(a) * r, 1.95, Math.cos(a) * r], target: [fx, HEAD_Y - 0.08, fz], push: 0.12 };
}

/** The shot for a moment: the seat that holds it, or the whole table. */
export const shotFor = (focus: number | null, wide: boolean): Shot => (wide || focus === null ? WIDE : shotOf(focus));
