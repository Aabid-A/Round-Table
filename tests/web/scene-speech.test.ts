import { describe, expect, it } from 'vitest';
import { speechPlacement } from '../../web/src/scene/stage/speech.js';

const inside = (c: { x: number; y: number }, box: { x: number; y: number }): boolean => c.x - box.x / 2 >= -1 && c.x + box.x / 2 <= 1 && c.y - box.y / 2 >= -1 && c.y + box.y / 2 <= 1;

describe('where a speaker’s words go', () => {
  const half = { x: 0.06, y: 0.1 };
  const box = { x: 0.5, y: 0.2 };
  it('sits beside the mask, on the side toward the middle, level with it', () => {
    const right = speechPlacement({ x: 0.5, y: 0.3 }, half, box);
    expect(right.x + box.x / 2).toBeLessThanOrEqual(0.5 - half.x);
    expect(right.y).toBeCloseTo(0.3);
    const left = speechPlacement({ x: -0.4, y: 0.2 }, half, box);
    expect(left.x - box.x / 2).toBeGreaterThanOrEqual(-0.4 + half.x);
  });
  it('takes the other side when the middle side has no room, and goes above the mask when neither has', () => {
    const near = speechPlacement({ x: 0.1, y: 0 }, half, { x: 1.0, y: 0.2 });
    expect(near.x - 0.5).toBeGreaterThanOrEqual(-1);
    const wide = { x: 1.5, y: 0.3 };
    const above = speechPlacement({ x: 0, y: 0 }, half, wide);
    expect(above.y - wide.y / 2).toBeGreaterThan(half.y);
    expect(inside(above, wide)).toBe(true);
  });
  it('never leaves the picture or goes under the buttons, wherever the speaker is', () => {
    for (const head of [{ x: 0.98, y: 0.9 }, { x: -1.4, y: -0.95 }, { x: 0, y: 1.3 }, { x: 2, y: 0 }]) {
      const c = speechPlacement(head, half, box);
      expect(inside(c, box)).toBe(true);
      expect(c.y + box.y / 2).toBeLessThanOrEqual(1 - 0.16 + 1e-9);
    }
  });
});
