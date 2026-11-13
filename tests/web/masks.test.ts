import { describe, expect, it } from 'vitest';
import { ACCENTS, PALETTE } from '../../web/src/scene/palette.js';
import { MASKS, maskDistance, maskOutline } from '../../web/src/scene/models/masks.js';

/** WCAG relative luminance of a #rrggbb colour. */
const luminance = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe('the eight masks', () => {
  it('are eight, each with its own shape, emblem and accent, so no two can be confused', () => {
    expect(MASKS).toHaveLength(8);
    for (const key of ['shape', 'emblem', 'colour'] as const) expect(new Set(MASKS.map((m) => m[key])).size, key).toBe(8);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) expect(maskDistance(MASKS[i]!, MASKS[j]!), `${i} and ${j}`).toBe(3);
  });

  it('have outlines that are real polygons, tall enough to read, and all different', () => {
    const outlines = MASKS.map((m) => maskOutline(m.shape));
    for (const o of outlines) {
      expect(o.length).toBeGreaterThanOrEqual(4);
      const ys = o.map((p) => p[1]);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(1.59);
    }
    expect(new Set(outlines.map((o) => JSON.stringify(o))).size).toBe(8);
  });

  it('use accents that stay apart: no two within 20 degrees of hue unless their lightness differs a lot, and all readable against the stone', () => {
    for (let i = 0; i < ACCENTS.length; i++) {
      expect(luminance(ACCENTS[i]!), ACCENTS[i]).toBeGreaterThan(luminance(PALETTE.stone) + 0.08);
      for (let j = i + 1; j < ACCENTS.length; j++) {
        const dh = Math.min(Math.abs(hue(ACCENTS[i]!) - hue(ACCENTS[j]!)), 360 - Math.abs(hue(ACCENTS[i]!) - hue(ACCENTS[j]!)));
        const dl = Math.abs(luminance(ACCENTS[i]!) - luminance(ACCENTS[j]!));
        expect(dh > 20 || dl > 0.15, `${ACCENTS[i]} and ${ACCENTS[j]} look alike`).toBe(true);
      }
    }
  });

  it('keep traitor red out of the accents: it is for reveals', () => {
    for (const a of ACCENTS) expect(Math.min(Math.abs(hue(a) - hue(PALETTE.traitor)), 360 - Math.abs(hue(a) - hue(PALETTE.traitor))) > 12 || luminance(a) > 0.3).toBe(true);
  });
});
