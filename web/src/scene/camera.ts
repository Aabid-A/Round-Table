export const degrees = (i: number, n: number): number => (i / n) * 360;

/** The angle that equals `target` modulo 360 and is closest to `previous`, so the camera takes the short way round. */
export function nearestAngle(previous: number, target: number): number {
  const turns = Math.round((previous - target) / 360);
  return target + turns * 360;
}
