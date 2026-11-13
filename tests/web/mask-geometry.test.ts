import { describe, expect, it } from 'vitest';
import { maskGeometry, maskHeight, maskLiningGeometry, MASK_THICKNESS } from '../../web/src/scene/models/maskGeometry.js';
import { MASKS, maskOutline, outlineRadius } from '../../web/src/scene/models/masks.js';

describe('a sculpted mask', () => {
  it('has an outline that is seen whole from its middle, so it can be one curved surface', () => {
    for (const m of MASKS) {
      const o = maskOutline(m.shape);
      const angles = o.map(([x, y]) => (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2));
      const turns = angles.filter((a, i) => a < angles[(i + angles.length - 1) % angles.length]!).length;
      expect(turns, m.shape).toBe(1);
      for (const [x, y] of o) expect(outlineRadius(o, Math.atan2(y, x)), m.shape).toBeCloseTo(Math.hypot(x, y), 5);
    }
  });
  it('curves round the face, with a nose that stands out and eyes set in', () => {
    expect(maskHeight(0, 0)).toBeGreaterThan(maskHeight(0.6, 0) + 0.1);
    expect(maskHeight(0, -0.2)).toBeGreaterThan(maskHeight(0.25, -0.2) + 0.08);
    expect(maskHeight(0.27, 0.1)).toBeLessThan(maskHeight(0.27, 0.32));
  });
  it('is solid: a front that faces forward, a back behind it by its thickness, and a rim between', () => {
    for (const m of MASKS) {
      const g = maskGeometry(m);
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      expect(pos.count).toBeGreaterThan(3000);
      expect(pos.count).toBeLessThan(40000);
      let front = 0;
      let back = 0;
      for (let i = 0; i < pos.count; i++) {
        expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i) + nor.getZ(i))).toBe(true);
        // Near the middle of the face, the forward skin looks forward and the skin behind it looks back.
        if (Math.hypot(pos.getX(i), pos.getY(i) + 0.6) < 0.1) pos.getZ(i) > maskHeight(pos.getX(i), pos.getY(i)) - MASK_THICKNESS / 2 ? (front += nor.getZ(i)) : (back += nor.getZ(i));
      }
      expect(front, m.shape).toBeGreaterThan(0);
      expect(back, m.shape).toBeLessThan(0);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeGreaterThan(0.3);
    }
  });
  it('carries the wearer\'s colour and a lining that faces backward', () => {
    const g = maskGeometry(MASKS[3]!);
    expect(g.getAttribute('color').count).toBe(g.getAttribute('position').count);
    const lining = maskLiningGeometry(MASKS[3]!);
    const nor = lining.getAttribute('normal');
    let z = 0;
    for (let i = 0; i < nor.count; i++) z += nor.getZ(i);
    expect(z).toBeLessThan(0);
  });
});
