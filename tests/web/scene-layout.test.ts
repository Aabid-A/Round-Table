import { describe, expect, it } from 'vitest';
import { chairPose, figurePose, platePose, seatAngle, SEATS, tablePoint, yawToSeat } from '../../web/src/scene/layout.js';
import { fovFor } from '../../web/src/scene/camera/fov.js';
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
  it('lays a name plate on the table edge', () => {
    for (let i = 0; i < SEATS; i++) {
      const [x, y, z] = platePose(i).position;
      expect(Math.hypot(x, z)).toBeLessThan(TABLE_R);
      expect(y).toBeGreaterThan(0.7);
    }
    expect(tablePoint(2, 1)[0]).toBeCloseTo(1);
  });
  it('turns the head to the right for seats on your right and to the left for the others', () => {
    expect(yawToSeat(0)).toBeCloseTo(0);
    expect(yawToSeat(1)).toBeGreaterThan(0);
    expect(yawToSeat(7)).toBeLessThan(0);
    expect(yawToSeat(4)).toBeCloseTo(0, 1);
  });
});

describe('the field of view', () => {
  it('keeps about the same width of view in a tall window, within limits', () => {
    expect(fovFor(16 / 9)).toBeCloseTo(58, 0);
    expect(fovFor(1)).toBeGreaterThan(fovFor(16 / 9));
    expect(fovFor(390 / 844)).toBe(96);
    expect(fovFor(5)).toBe(58);
  });
});
