/**
 * How much to shrink caption text so a long speech still fits the frame.
 * 1 for a short line, down to a floor for very long text (CSS then clamps lines).
 */
export function textScale(chars: number): number {
  if (chars <= 100) return 1;
  if (chars <= 200) return 0.8;
  if (chars <= 320) return 0.64;
  if (chars <= 480) return 0.52;
  return 0.44;
}
