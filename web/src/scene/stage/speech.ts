/** A point or size on the picture in normalised device coordinates: -1 to 1 across and up. */
export interface Ndc {
  x: number;
  y: number;
}

/** Room kept clear at the top of the picture for the buttons, and a margin everywhere else. */
const TOP = 0.16;
const EDGE = 0.04;

const clamp = (n: number, lo: number, hi: number): number => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, n)));

/**
 * Where a speaker's words go on the picture: beside the speaker's mask, on the side toward the middle of the picture, level with the
 * mask. If neither side has room (a narrow picture, the speaker filling it) they go above the mask. They never leave the picture or
 * sit under the buttons. `head` is the mask's middle, `headHalf` half its width, `box` the size of the words, all in device units.
 */
export function speechPlacement(head: Ndc, headHalf: Ndc, box: Ndc): Ndc {
  const loX = -1 + EDGE + box.x / 2;
  const hiX = 1 - EDGE - box.x / 2;
  const loY = -1 + EDGE + box.y / 2;
  const hiY = 1 - TOP - box.y / 2;
  const fits = (x: number): boolean => x >= loX - 1e-9 && x <= hiX + 1e-9;
  const toMiddle = head.x > 0 ? -1 : 1;
  for (const side of [toMiddle, -toMiddle]) {
    const x = head.x + side * (headHalf.x + 0.02 + box.x / 2);
    if (fits(x)) return { x, y: clamp(head.y, loY, hiY) };
  }
  return { x: clamp(head.x, loX, hiX), y: clamp(head.y + headHalf.y + 0.03 + box.y / 2, loY, hiY) };
}
