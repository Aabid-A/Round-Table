/** How far the head turns with the pointer (radians each way): further in a narrow window, where less of the table is in view at once. */
export function yawArcFor(aspect: number): number {
  return aspect >= 1.2 ? 0.62 : Math.min(1, 0.62 + (1.2 - aspect) * 0.55);
}

/** How far down the eye rests (radians, negative is down): on the table in a wide window, nearer level in a tall one, so a phone's height shows the hall above the table and not the floor under it. */
export function restPitchFor(aspect: number): number {
  return aspect >= 1.2 ? -0.18 : Math.min(-0.07, -0.18 + (1.2 - aspect) * 0.15);
}

/** The vertical field of view that keeps a horizontal view of about 89 degrees, within 58 and 88: a tall window gets a narrower, closer view of the table. */
export function fovFor(aspect: number): number {
  const v = (2 * Math.atan(Math.tan((89 * Math.PI) / 360) / Math.max(0.2, aspect)) * 180) / Math.PI;
  return Math.max(58, Math.min(88, v));
}
