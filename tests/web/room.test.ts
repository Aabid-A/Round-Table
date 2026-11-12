import { describe, expect, it } from 'vitest';
import { nearestAngle } from '../../web/src/scene/Room.js';

describe('nearestAngle', () => {
  it('takes the short way round: from 315 to 0 goes on to 360, not back to 0', () => {
    expect(nearestAngle(315, 0)).toBe(360);
    expect(nearestAngle(0, 315)).toBe(-45);
    expect(nearestAngle(360, 45)).toBe(405);
  });
  it('stays put when already there', () => {
    expect(nearestAngle(90, 90)).toBe(90);
    expect(nearestAngle(450, 90)).toBe(450);
  });
});
