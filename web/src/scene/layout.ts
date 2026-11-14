import { SEAT_R, TABLE_R, TABLE_Y } from './models/dimensions.js';

export const SEATS = 8;

/** The angle of seat `i` around the table, from the player's own seat at 0 (nearest the camera, +z), going round clockwise seen from above. */
export const seatAngle = (i: number): number => (i / SEATS) * Math.PI * 2;

export interface Pose {
  position: [number, number, number];
  /** Turn about the up axis that makes the thing at this seat face the middle of the table. */
  facing: number;
}

/** Where a chair stands. The chair's front is +z in its own space; turning it by angle + PI faces the table's middle. */
export function chairPose(i: number, pushedBack = 0): Pose {
  const a = seatAngle(i);
  const r = SEAT_R + pushedBack;
  return { position: [Math.sin(a) * r, 0, Math.cos(a) * r], facing: a + Math.PI };
}

/** Where a seated figure's body is: on the chair, a little in front of its back. */
export function figurePose(i: number): Pose {
  const a = seatAngle(i);
  const r = SEAT_R - 0.1;
  return { position: [Math.sin(a) * r, 0, Math.cos(a) * r], facing: a + Math.PI };
}

/** A point on the table surface at distance `r` from the middle toward seat `i`. */
export function tablePoint(i: number, r: number): [number, number, number] {
  const a = seatAngle(i);
  return [Math.sin(a) * r, TABLE_Y, Math.cos(a) * r];
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
