import { describe, expect, it } from 'vitest';
import { chordBetween, nearestAngle } from '../../web/src/scene/camera.js';

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

describe('chordBetween', () => {
  it('joins two seats: across the table it is a diameter through the centre, between neighbours a short chord near the rim', () => {
    const across = chordBetween(0, 4, 8);
    expect(across.dist).toBeCloseTo(0, 5);
    expect(across.len).toBeCloseTo(2, 5);
    const next = chordBetween(0, 1, 8);
    expect(next.mid).toBeCloseTo(22.5, 5);
    expect(next.len).toBeCloseTo(2 * Math.sin(Math.PI / 8), 5);
    expect(next.dist).toBeCloseTo(Math.cos(Math.PI / 8), 5);
  });
  it('is the same line whichever end is first, and goes the short way round the seam', () => {
    const a = chordBetween(7, 1, 8);
    const b = chordBetween(1, 7, 8);
    expect(a.len).toBeCloseTo(b.len, 9);
    expect(a.dist).toBeCloseTo(b.dist, 9);
    expect(Math.cos((a.mid * Math.PI) / 180)).toBeCloseTo(1, 5); // the middle of seats 7 and 1 is seat 0, at the angle 0 (or 360)
  });
});
