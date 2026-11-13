import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { figurePose, headYaw, MASK_MAX_OFF, NECK_MAX, SEATS, yawBetween } from '../../web/src/scene/layout.js';
import { cloakGeometry, hoodGeometry, mantleGeometry, sleeveGeometry } from '../../web/src/scene/models/cloak.js';
import { folds, keyed } from '../../web/src/scene/models/cloth.js';
import { handGeometry } from '../../web/src/scene/models/hand.js';

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
    const sleeve = sleeveGeometry(0.4, '#3fa9a0');
    expect(bounds(sleeve).max[2]).toBeCloseTo(0.4, 1);
  });
});

describe('a hand', () => {
  it('is a shaped hand about as long as a hand, and longer when it points than a fist would be', () => {
    const rest = bounds(handGeometry('rest'));
    const point = bounds(handGeometry('point'));
    expect(rest.max[2]).toBeGreaterThan(0.15);
    expect(rest.max[2]).toBeLessThan(0.22);
    // Wider than a finger: it has a palm and a thumb.
    expect(rest.max[0]! - rest.min[0]!).toBeGreaterThan(0.07);
    expect(point.max[2]).toBeGreaterThan(0.15);
    // The folded fingers of a pointing hand hang below the palm.
    expect(point.min[1]).toBeLessThan(rest.min[1]! - 0.01);
  });
});
