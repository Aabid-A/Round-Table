import { describe, expect, it } from 'vitest';
import { shotFor, shotOf, WIDE } from '../../web/src/scene/camera/shots.js';
import { figurePose, SEATS, setSpacing } from '../../web/src/scene/layout.js';

describe('the director’s shots', () => {
  it('films a speaker from across the table, above the table and outside the ring of chairs', () => {
    setSpacing('even');
    try {
      for (let i = 0; i < SEATS; i++) {
        const s = shotOf(i);
        const [fx, , fz] = figurePose(i).position;
        // From the other side of the table: the camera and the speaker are on opposite sides of the middle.
        expect(s.position[0] * fx + s.position[2] * fz).toBeLessThan(0);
        expect(Math.hypot(s.position[0], s.position[2])).toBeGreaterThan(3);
        expect(s.position[1]).toBeGreaterThan(1.5);
        expect(s.target).toEqual([fx, s.target[1], fz]);
      }
    } finally {
      setSpacing('seated');
    }
  });
  it('pulls back wide for the whole table, or when no one holds the moment', () => {
    expect(shotFor(3, true)).toBe(WIDE);
    expect(shotFor(null, false)).toBe(WIDE);
    expect(shotFor(3, false)).not.toBe(WIDE);
  });
});
