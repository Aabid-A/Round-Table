import { describe, expect, it } from 'vitest';
import { BESIDE_BACK, chairPose, figurePose, platePose, plateShown, seatAngle, SEATS, tablePoint } from '../../web/src/scene/layout.js';
import { bearingTo, fovFor, nearestStop, restPitchFor, SWIPE_MAX, yawArcFor } from '../../web/src/scene/camera/fov.js';
import { EYE_Z, SEAT_R, TABLE_R } from '../../web/src/scene/models/dimensions.js';

describe('the seats around the table', () => {
  it('has eight seats in mirror pairs, your own at the camera and the seat across from it straight ahead', () => {
    expect(SEATS).toBe(8);
    expect(seatAngle(0)).toBe(0);
    expect(seatAngle(4)).toBeCloseTo(Math.PI);
    for (let i = 1; i < 4; i++) expect(seatAngle(i) + seatAngle(SEATS - i)).toBeCloseTo(Math.PI * 2);
    for (let i = 1; i < SEATS; i++) expect(seatAngle(i)).toBeGreaterThan(seatAngle(i - 1));
    expect(chairPose(0).position[2]).toBeCloseTo(SEAT_R);
    expect(chairPose(0).position[0]).toBeCloseTo(0);
  });
  it('gives the seats beside you more room and sets them back, so they stay out of a wide picture until you turn', () => {
    expect(seatAngle(1)).toBeGreaterThan(seatAngle(2) - seatAngle(1));
    expect(Math.hypot(chairPose(1).position[0], chairPose(1).position[2])).toBeCloseTo(SEAT_R + BESIDE_BACK);
    // In a 16:9 picture (vertical field 58 degrees) seat 2's figure, about 0.4 m either side of its middle, is whole, and the near side of seat 1's is outside.
    const half = Math.atan(Math.tan((fovFor(16 / 9) * Math.PI) / 360) * (16 / 9));
    const spread = (i: number): number => Math.asin(0.4 / Math.hypot(figurePose(i).position[0], EYE_Z - figurePose(i).position[2]));
    expect(bearingTo(2) + spread(2)).toBeLessThan(half);
    expect(bearingTo(1) - spread(1)).toBeGreaterThan(half);
  });
  it('puts every chair the same distance from the middle (the two beside you a little further), and no two together', () => {
    const pts = Array.from({ length: SEATS }, (_, i) => chairPose(i).position);
    pts.forEach(([x, , z], i) => expect(Math.hypot(x, z)).toBeCloseTo(SEAT_R + (i === 1 || i === 7 ? BESIDE_BACK : 0)));
    for (let i = 0; i < SEATS; i++) for (let j = i + 1; j < SEATS; j++) expect(Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![2] - pts[j]![2])).toBeGreaterThan(1.5);
  });
  it('seats a figure on its chair, a little nearer the table, facing the middle', () => {
    for (let i = 0; i < SEATS; i++) {
      const [x, , z] = figurePose(i).position;
      expect(Math.hypot(x, z)).toBeLessThan(Math.hypot(chairPose(i).position[0], chairPose(i).position[2]));
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
    expect(tablePoint(4, 1)[2]).toBeCloseTo(-1);
    expect(Math.hypot(tablePoint(2, 1)[0], tablePoint(2, 1)[2])).toBeCloseTo(1);
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

describe('a mask on the table', () => {
  it('from your seat never covers its name plate: they are apart across the picture or up and down it', async () => {
    const { BANISHED_TILT, banishedMaskSpot, bearingFromEye, dawnMaskSpot, plateScale } = await import('../../web/src/scene/layout.js');
    const { BANISHED_MASK_HALF, DAWN_MASK_HALF, DAWN_MASK_SCALE, EYE_Y, PLATE_H, PLATE_W, TABLE_Y } = await import('../../web/src/scene/models/dimensions.js');
    const dist = (p: [number, number, number]): number => Math.hypot(p[0], EYE_Z - p[2]);
    const across = (p: [number, number, number], half: number): [number, number] => {
      const b = bearingFromEye(p);
      const w = Math.atan(half / dist(p));
      return [b - w, b + w];
    };
    const upDown = (p: [number, number, number], lo: number, hi: number): [number, number] => [Math.atan((lo - EYE_Y) / dist(p)), Math.atan((hi - EYE_Y) / dist(p))];
    const apart = (a: [number, number], b: [number, number]): boolean => a[1] < b[0] || b[1] < a[0];
    // A mask lies 0.09 above the wood, tipped toward you, and stands up to about its scale above that.
    const dawnTop = TABLE_Y + 0.09 + DAWN_MASK_SCALE * 1.05;
    const banishedTop = TABLE_Y + 0.09 + 0.2 * 1.05 * Math.sin(BANISHED_TILT) + 0.02;
    for (let i = 1; i < SEATS; i++) {
      const plate = platePose(i, 0).position;
      const pa = across(plate, ((PLATE_W + 0.02) / 2) * plateScale(i, 0));
      const pu = upDown(plate, TABLE_Y, TABLE_Y + PLATE_H + 0.016);
      for (const [spot, half, top] of [[dawnMaskSpot(i), DAWN_MASK_HALF, dawnTop], [banishedMaskSpot(i), BANISHED_MASK_HALF, banishedTop]] as const) {
        expect(Math.hypot(spot[0], spot[2]), `seat ${i}`).toBeLessThan(TABLE_R - 0.15);
        expect(apart(across(spot, half), pa) || apart(upDown(spot, TABLE_Y, top), pu), `seat ${i}`).toBe(true);
      }
    }
  });
});
