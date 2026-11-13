import { SEAT_R, TABLE_R, TABLE_Y } from './models/Table.js';

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

/** Where a seat's name plate stands: at the table's edge, facing the middle, so it reads from across the table. */
export const platePose = (i: number): Pose => ({ position: tablePoint(i, TABLE_R - 0.2), facing: seatAngle(i) + Math.PI });

/** The yaw (radians, 0 straight ahead, positive to the right) from the seat at 0 to seat `i`, for turning a head or a camera toward it. */
export function yawToSeat(i: number): number {
  const [x, , z] = chairPose(i).position;
  const [, , z0] = chairPose(0).position;
  return Math.atan2(x, z0 - z);
}
