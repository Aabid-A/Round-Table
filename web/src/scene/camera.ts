export const degrees = (i: number, n: number): number => (i / n) * 360;

/** The angle that equals `target` modulo 360 and is closest to `previous`, so the camera takes the short way round. */
export function nearestAngle(previous: number, target: number): number {
  const turns = Math.round((previous - target) / 360);
  return target + turns * 360;
}

/**
 * The straight line between two seats on the ring, as the room draws it: the angle of its middle (degrees), how far the
 * middle is from the centre (a share of the ring's radius) and how long it is (a share of the radius). Takes the short way round.
 */
export function chordBetween(a: number, b: number, n: number): { mid: number; dist: number; len: number } {
  const t1 = (a / n) * 2 * Math.PI;
  const t2 = (b / n) * 2 * Math.PI;
  const d = ((((t2 - t1 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return { mid: ((t1 + d / 2) * 180) / Math.PI, dist: Math.cos(Math.abs(d) / 2), len: 2 * Math.sin(Math.abs(d) / 2) };
}
