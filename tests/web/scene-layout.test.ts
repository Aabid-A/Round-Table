import { describe, expect, it } from 'vitest';
import { chairPose, figurePose, platePose, plateShown, seatAngle, SEATS, tablePoint } from '../../web/src/scene/layout.js';
import { bearingTo, fovFor, nearestStop, restPitchFor, SWIPE_MAX, yawArcFor } from '../../web/src/scene/camera/fov.js';
import { SEAT_R, TABLE_R } from '../../web/src/scene/models/dimensions.js';

describe('the seats around the table', () => {
  it('has eight seats at equal angles, your own at the camera', () => {
    expect(SEATS).toBe(8);
    expect(seatAngle(0)).toBe(0);
    expect(seatAngle(4)).toBeCloseTo(Math.PI);
    expect(chairPose(0).position[2]).toBeCloseTo(SEAT_R);
    expect(chairPose(0).position[0]).toBeCloseTo(0);
  });
  it('puts every chair the same distance from the middle, and no two together', () => {
    const pts = Array.from({ length: SEATS }, (_, i) => chairPose(i).position);
    for (const [x, , z] of pts) expect(Math.hypot(x, z)).toBeCloseTo(SEAT_R);
    for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) expect(Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![2] - pts[j]![2])).toBeGreaterThan(1.5);
  });
  it('seats a figure on its chair, a little nearer the table, facing the middle', () => {
    for (let i = 0; i < SEATS; i++) {
      const [x, , z] = figurePose(i).position;
      expect(Math.hypot(x, z)).toBeLessThan(SEAT_R);
      const f = figurePose(i).facing;
      // A figure's front is its local +z turned by facing; that must point at the middle.
      const front = [Math.sin(f), Math.cos(f)];
      expect(front[0]! * x + front[1]! * z).toBeLessThan(0);
    }
  });
  it('stands a name plate on the table in front of each seat, turned to face the viewer', () => {
    for (let i = 0; i < SEATS; i++) {
      const pose = platePose(i, 0);
      const [x, y, z] = pose.position;
      expect(Math.hypot(x, z)).toBeLessThan(TABLE_R);
      expect(y).toBeGreaterThan(0.7);
      if (i === 0) continue;
      // The plate's face (its local +z turned by facing) looks at the viewer's chair.
      const [vx, , vz] = chairPose(0).position;
      const d = Math.hypot(vx - x, vz - z);
      expect(Math.sin(pose.facing)).toBeCloseTo((vx - x) / d);
      expect(Math.cos(pose.facing)).toBeCloseTo((vz - z) / d);
    }
    expect(tablePoint(2, 1)[0]).toBeCloseTo(1);
  });
  it('finds seats on your right to the right and the others to the left', () => {
    expect(bearingTo(4)).toBeCloseTo(0);
    expect(bearingTo(1)).toBeGreaterThan(0);
    expect(bearingTo(7)).toBeLessThan(0);
    expect(bearingTo(1)).toBeCloseTo(-bearingTo(7));
  });
  it('shows a name plate whole or not at all', () => {
    expect(plateShown(-0.2, 0.1)).toBe(1);
    expect(plateShown(0.7, 0.9)).toBe(1);
    // Touching or past the edge: gone, never half a name.
    expect(plateShown(0.8, 1)).toBe(0);
    expect(plateShown(0.9, 1.2)).toBe(0);
    expect(plateShown(-1.3, -0.9)).toBe(0);
    expect(plateShown(0, 0.1, true)).toBe(0);
    const fading = plateShown(0.8, 0.96);
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
  });
});

describe('the field of view', () => {
  it('keeps about the same width of view in a wide window', () => {
    expect(fovFor(16 / 9)).toBeCloseTo(58, 0);
    expect(fovFor(1)).toBeGreaterThan(fovFor(16 / 9));
    expect(fovFor(5)).toBe(58);
  });
  it('in a tall window comes closer and looks level, so the hands and the table edge sit on the bottom of the screen', () => {
    const tall = 390 / 844;
    expect(fovFor(tall)).toBe(52);
    expect(restPitchFor(16 / 9)).toBe(-0.18);
    expect(restPitchFor(tall)).toBeGreaterThan(-0.05);
    // The bottom of the picture is no lower than the near edge of the table (about 0.5 radian below level from the eye): no floor under it.
    expect(restPitchFor(tall) - (fovFor(tall) * Math.PI) / 360).toBeGreaterThan(-0.5);
    expect(yawArcFor(16 / 9)).toBe(0.62);
  });
  it('lets a swipe reach every seat and rests it facing a figure', () => {
    for (let i = 1; i < SEATS; i++) expect(Math.abs(bearingTo(i))).toBeLessThan(SWIPE_MAX);
    expect(nearestStop(0.05)).toBeCloseTo(0);
    expect(nearestStop(0.3)).toBeCloseTo(bearingTo(3));
    expect(nearestStop(-0.9)).toBeCloseTo(bearingTo(7));
    expect(nearestStop(5)).toBeCloseTo(bearingTo(1));
  });
});
