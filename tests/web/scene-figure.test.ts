import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { figurePose, headYaw, MASK_MAX_OFF, NECK_MAX, SEATS, yawBetween } from '../../web/src/scene/layout.js';
import { cloakGeometry, cuffBandGeometry, hoodGeometry, mantleGeometry, sleeveGeometry } from '../../web/src/scene/models/cloak.js';
import { folds, keyed } from '../../web/src/scene/models/cloth.js';
import { boneProfile, handGeometry } from '../../web/src/scene/models/hand.js';

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

describe('where a figure turns', () => {
  it('points at the seat it is asked to', () => {
    for (let from = 0; from < SEATS; from++) {
      for (let to = 0; to < SEATS; to++) {
        if (from === to) continue;
        const a = figurePose(from);
        const world = a.facing + yawBetween(from, to);
        const [tx, , tz] = figurePose(to).position;
        const d = Math.hypot(tx - a.position[0], tz - a.position[2]);
        expect(Math.sin(world)).toBeCloseTo((tx - a.position[0]) / d);
        expect(Math.cos(world)).toBeCloseTo((tz - a.position[2]) / d);
      }
    }
  });
  it('never turns a mask edge-on to the viewer, whoever it looks at, and never past its shoulders', () => {
    for (let seat = 1; seat < SEATS; seat++) {
      for (const look of [null, ...Array.from({ length: SEATS }, (_, i) => i)]) {
        const yaw = headYaw(seat, look, 0);
        expect(Math.abs(yaw)).toBeLessThanOrEqual(NECK_MAX + 1e-9);
        expect(Math.abs(wrap(yaw - yawBetween(seat, 0)))).toBeLessThanOrEqual(MASK_MAX_OFF + 1e-9);
      }
    }
  });
  it('looks straight at the viewer when asked to, and toward a neighbour when it can', () => {
    for (let seat = 1; seat < SEATS; seat++) expect(headYaw(seat, 0, 0)).toBeCloseTo(yawBetween(seat, 0));
    // The seat across the table can look at the seat beside the viewer without losing the viewer.
    expect(headYaw(4, 1, 0)).toBeCloseTo(yawBetween(4, 1));
  });
});

const bounds = (g: BufferGeometry): { min: number[]; max: number[] } => {
  g.computeBoundingBox();
  return { min: g.boundingBox!.min.toArray(), max: g.boundingBox!.max.toArray() };
};
const finite = (g: BufferGeometry): boolean => Array.from(g.getAttribute('position').array).every(Number.isFinite) && Array.from(g.getAttribute('normal').array).every(Number.isFinite);

describe('the cloth', () => {
  it('reads a curve through every key row', () => {
    const f = keyed([[0, 1], [1, 3], [2, 2]]);
    expect(f(0)).toEqual([0, 1]);
    expect(f(0.5)[1]).toBeCloseTo(3);
    expect(f(1)[1]).toBeCloseTo(2);
  });
  it('folds differently for each seed, within bounds', () => {
    const a = folds(1);
    const b = folds(2);
    let differs = false;
    for (let t = 0; t < 6.2; t += 0.3) {
      expect(Math.abs(a(t, 0))).toBeLessThanOrEqual(1);
      if (Math.abs(a(t, 0) - b(t, 0)) > 0.05) differs = true;
    }
    expect(differs).toBe(true);
  });
  it('makes a cloak from the floor to the neck, wider than deep at the shoulders, facing outward', () => {
    const g = cloakGeometry(3, '#d9743a');
    expect(finite(g)).toBe(true);
    const b = bounds(g);
    expect(b.min[1]).toBeLessThan(0.1);
    expect(b.max[1]).toBeGreaterThan(1.2);
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    let out = 0;
    for (let i = 0; i < pos.count; i++) out += Math.sign(pos.getX(i) * nor.getX(i));
    expect(out).toBeGreaterThan(pos.count * 0.5);
    expect(g.getAttribute('color')).toBeDefined();
  });
  it('makes a cape, a hood that hangs forward over the face, and a sleeve', () => {
    expect(finite(mantleGeometry(1, '#3fa9a0'))).toBe(true);
    const hood = hoodGeometry(1);
    expect(finite(hood)).toBe(true);
    expect(bounds(hood).max[2]).toBeGreaterThan(0.18);
    const sleeve = sleeveGeometry(0.4);
    expect(bounds(sleeve).max[2]).toBeCloseTo(0.4, 1);
    // The band sits round the cuff end of the sleeve, a little outside it.
    const band = bounds(cuffBandGeometry(0.4));
    expect(band.min[2]).toBeGreaterThan(0.3);
    expect(band.max[2]).toBeLessThan(0.4);
    expect(band.max[0]).toBeGreaterThan(0.07);
  });
});

describe('a hand', () => {
  it('is a shaped hand about as long as a hand, and longer when it points than a fist would be', () => {
    const rest = bounds(handGeometry('rest'));
    const point = bounds(handGeometry('point'));
    // At rest the fingers arch, so the hand reaches a little less far than when it points.
    expect(rest.max[2]).toBeGreaterThan(0.14);
    expect(rest.max[2]).toBeLessThan(0.22);
    // Wider than a finger: it has a palm and a thumb.
    expect(rest.max[0]! - rest.min[0]!).toBeGreaterThan(0.07);
    expect(point.max[2]).toBeGreaterThan(0.15);
    // The folded fingers of a pointing hand hang well below the palm (whose underside is about 1.4 cm down).
    expect(point.min[1]).toBeLessThan(-0.03);
  });
});

describe('your resting hand', () => {
  it('lies on the table: fingertips and the heel of the hand within a few millimetres of the wood, none of it below', async () => {
    const THREE = await import('three');
    const { HAND_SCALE, REST_POSE } = await import('../../web/src/scene/actors/handRest.js');
    const g = handGeometry('rest');
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(REST_POSE.pitch, 0, 0, 'YXZ')).multiply(new THREE.Matrix4().makeScale(HAND_SCALE, HAND_SCALE, HAND_SCALE));
    const v = new THREE.Vector3();
    let lowest = Infinity;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) lowest = Math.min(lowest, v.fromBufferAttribute(pos, i).applyMatrix4(m).y);
    const aboveTable = REST_POSE.lift + lowest;
    expect(aboveTable).toBeGreaterThan(-0.002);
    expect(aboveTable).toBeLessThan(0.008);
  });
});

describe('a finger bone', () => {
  it('is waisted between its joints, not a tube of one width', () => {
    const p = boneProfile(0.009, 0.04, false);
    const at = (y: number): number => p.reduce((best, q) => (Math.abs(q[1] - y) < Math.abs(best[1] - y) ? q : best))[0];
    expect(at(0.02)).toBeLessThan(at(0) * 0.9);
    expect(at(0.04)).toBeGreaterThan(at(0.02));
  });
  it('ends a finger in a tip narrower than its joint', () => {
    const p = boneProfile(0.009, 0.02, true);
    const radii = p.filter(([, y]) => y > 0.02).map(([r]) => r);
    expect(Math.max(...radii)).toBeLessThan(0.009 * 0.7);
    expect(p[p.length - 1]![0]).toBe(0);
  });
});
