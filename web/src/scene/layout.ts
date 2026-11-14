import { DAWN_MASK_HALF, DAWN_REACH, EYE_Z, PLATE_W, SEAT_R, TABLE_R, TABLE_Y } from './models/dimensions.js';

export const SEATS = 8;

/**
 * Where each seat is round the table, in degrees from the player's own seat at 0 (nearest the camera, +z), clockwise seen from above.
 * The two seats beside you are given more room (58 degrees, the rest about 41), so from your chair the figure across the corner of
 * the table is whole in a wide picture while the ones beside you stay out of it until you turn to them.
 */
const ANGLES = [0, 58, 99, 140, 180, 220, 261, 302] as const;

/** The angle of seat `i` around the table, in radians (see ANGLES). */
export const seatAngle = (i: number): number => (ANGLES[((i % SEATS) + SEATS) % SEATS]! * Math.PI) / 180;

/** The seats beside yours sit a little back from the table, so they do not loom at the edges of your picture. */
export const BESIDE_BACK = 0.25;
const back = (i: number): number => (i === 1 || i === SEATS - 1 ? BESIDE_BACK : 0);

export interface Pose {
  position: [number, number, number];
  /** Turn about the up axis that makes the thing at this seat face the middle of the table. */
  facing: number;
}

/** Where a chair stands. The chair's front is +z in its own space; turning it by angle + PI faces the table's middle. */
export function chairPose(i: number, pushedBack = 0): Pose {
  const a = seatAngle(i);
  const r = SEAT_R + back(i) + pushedBack;
  return { position: [Math.sin(a) * r, 0, Math.cos(a) * r], facing: a + Math.PI };
}

/** Where a seated figure's body is: on the chair, a little in front of its back. */
export function figurePose(i: number): Pose {
  const a = seatAngle(i);
  const r = SEAT_R + back(i) - 0.1;
  return { position: [Math.sin(a) * r, 0, Math.cos(a) * r], facing: a + Math.PI };
}

/** A point on the table surface at distance `r` from the middle toward seat `i`. */
export function tablePoint(i: number, r: number): [number, number, number] {
  const a = seatAngle(i);
  return [Math.sin(a) * r, TABLE_Y, Math.cos(a) * r];
}

/**
 * Where the mask found at dawn lies: near the empty chair, moved along the table's edge toward the middle of your view just far
 * enough that, from your seat, the mask and its name plate do not cover each other (with a little room between them).
 */
export function dawnMaskSpot(i: number): [number, number, number] {
  const a = seatAngle(i);
  const [x, y, z] = tablePoint(i, DAWN_REACH);
  // Along the edge, the way that brings it toward the line straight across the table (the seat across goes to your left).
  const tx = Math.cos(a);
  const tz = -Math.sin(a);
  const toMiddle = Math.abs(x + tx * 0.01) < Math.abs(x) || (Math.abs(x) < 1e-6 && tx < 0) ? 1 : -1;
  const plate = platePose(i, 0).position;
  const plateSpan = span(plate, ((PLATE_W + 0.02) / 2) * plateScale(i, 0));
  let spot: [number, number, number] = [x, y, z];
  for (let aside = 0; aside <= 0.6; aside += 0.01) {
    spot = [x + tx * aside * toMiddle, y, z + tz * aside * toMiddle];
    const m = span(spot, DAWN_MASK_HALF);
    if (m[1] < plateSpan[0] - DAWN_GAP || plateSpan[1] < m[0] - DAWN_GAP) break;
  }
  return spot;
}

/** Room left between the dawn mask and its plate as you see them, in radians. */
const DAWN_GAP = 0.02;

/** How far across your view something reaches (radians, positive right), from its middle `p` and its half width `half`. */
function span(p: [number, number, number], half: number): [number, number] {
  const b = bearingFromEye(p);
  const w = Math.atan(half / Math.hypot(p[0], EYE_Z - p[2]));
  return [b - w, b + w];
}

/** Whether something at `p` is seen from your eye (radians across, positive right). */
export function bearingFromEye(p: [number, number, number]): number {
  return Math.atan2(p[0], EYE_Z - p[2]);
}

/**
 * Where a seat's name plate stands: on the table in front of its seat, turned to face the viewer's seat, so every name reads from
 * where the player sits (a plate that faced the middle would show the player its edge at the seats beside them).
 */
export function platePose(i: number, viewer: number): Pose {
  const position = tablePoint(i, TABLE_R - 0.2);
  if (i === viewer) return { position, facing: seatAngle(i) + Math.PI };
  const [vx, , vz] = chairPose(viewer).position;
  return { position, facing: Math.atan2(vx - position[0], vz - position[2]) };
}

/** The plates of the two seats beside the viewer stand much nearer than the rest, so they are made smaller: every name then reads at about the same size. */
export function plateScale(i: number, viewer: number): number {
  const apart = Math.min((i - viewer + SEATS) % SEATS, (viewer - i + SEATS) % SEATS);
  return apart === 1 ? 0.7 : 1;
}

/**
 * How much of a name plate to show, from where its two ends fall across the picture (-1 at the left edge, 1 at the right): all of it
 * while it is whole and clear of the edge, none of it by the time an end would touch the edge. A name is never left half cut off.
 */
export function plateShown(left: number, right: number, behind = false): number {
  if (behind) return 0;
  const margin = 1 - Math.max(Math.abs(left), Math.abs(right));
  return Math.max(0, Math.min(1, margin / 0.08));
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The turn about the up axis, relative to the figure at seat `from`'s own facing, that points it at seat `to`. */
export function yawBetween(from: number, to: number): number {
  const a = figurePose(from);
  const [tx, , tz] = figurePose(to).position;
  return wrap(Math.atan2(tx - a.position[0], tz - a.position[2]) - a.facing);
}

/** How far a mask may be turned away from the viewer: beyond this it starts to be seen edge-on. */
export const MASK_MAX_OFF = 0.7;
/** How far a head turns on its shoulders. */
export const NECK_MAX = 1.35;

/**
 * Where the head at seat `seat` turns (relative to its own facing) to look at seat `look`, or at the middle of the table for null.
 * It turns toward its target but never so far from the viewer's seat that its mask is seen edge-on, and never past its own shoulders.
 */
export function headYaw(seat: number, look: number | null, viewer: number): number {
  const want = look === null || look === seat ? 0 : yawBetween(seat, look);
  if (seat === viewer) return Math.max(-NECK_MAX, Math.min(NECK_MAX, want));
  const toViewer = yawBetween(seat, viewer);
  const off = Math.max(-MASK_MAX_OFF, Math.min(MASK_MAX_OFF, wrap(want - toViewer)));
  return Math.max(-NECK_MAX, Math.min(NECK_MAX, wrap(toViewer + off)));
}
