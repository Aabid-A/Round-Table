/** The vertical field of view that keeps a horizontal view of about 89 degrees, within 58 and 96. */
export function fovFor(aspect: number): number {
  const v = (2 * Math.atan(Math.tan((89 * Math.PI) / 360) / Math.max(0.2, aspect)) * 180) / Math.PI;
  return Math.max(58, Math.min(96, v));
}
