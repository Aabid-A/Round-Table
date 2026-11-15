import { ACCENTS } from '../palette.js';

/** The shape of a mask's face, told apart before colour is: see /art-direction ("mask shape, then colour, then name plate"). */
export type MaskShape = 'oval' | 'crest' | 'sun' | 'diamond' | 'slab' | 'long' | 'horned' | 'heart';

/** The small emblem on the brow, a second shape cue that does not depend on colour. */
export type Emblem = 'star' | 'ring' | 'bar' | 'dots' | 'cross' | 'drop' | 'wave' | 'tri';

export interface MaskDesign {
  shape: MaskShape;
  emblem: Emblem;
  colour: string;
  /** How far the whole face is tinted from bone toward the player's colour (0 to 1). */
  tint: number;
  /** How light the face is (1 as mixed, lower is darker), so two masks also differ in light and dark. */
  shade: number;
  /** How far each eye sits from the middle: closer on a narrow face. */
  eyes: number;
}

/**
 * Eight masks, one per seat: eight different outlines, emblems and colours. The whole face is tinted toward its colour and they
 * differ in light and dark as well, so that with the picture blurred until no detail is left each is still its own blot.
 */
export const MASKS: readonly MaskDesign[] = [
  { shape: 'oval', emblem: 'star', colour: ACCENTS[0], tint: 0.4, shade: 1, eyes: 0.27 },
  { shape: 'crest', emblem: 'ring', colour: ACCENTS[1], tint: 0.6, shade: 0.9, eyes: 0.3 },
  { shape: 'sun', emblem: 'bar', colour: ACCENTS[2], tint: 0.85, shade: 0.72, eyes: 0.24 },
  { shape: 'diamond', emblem: 'dots', colour: ACCENTS[3], tint: 0.6, shade: 1, eyes: 0.27 },
  { shape: 'slab', emblem: 'cross', colour: ACCENTS[4], tint: 0.8, shade: 1, eyes: 0.34 },
  { shape: 'long', emblem: 'drop', colour: ACCENTS[5], tint: 0.55, shade: 1, eyes: 0.16 },
  { shape: 'horned', emblem: 'wave', colour: ACCENTS[6], tint: 0.8, shade: 1, eyes: 0.22 },
  { shape: 'heart', emblem: 'tri', colour: ACCENTS[7], tint: 0.15, shade: 1, eyes: 0.32 },
];

/**
 * The outline of a mask in a box about two units tall, centred on 0. Each is a different silhouette at a glance, in outline, in
 * proportion and in size: an egg; a wide face under one tall peak; eight long rays; a sharp wide lozenge; a square slab; a face a
 * third as wide as it is tall; a small face under two great horns; a broad heart. Every outline can be seen whole from its own
 * middle (no part hides behind another), which is what lets the mask be sculpted as one curved surface.
 */
export function maskOutline(shape: MaskShape): [number, number][] {
  const ellipse = (rx: number, ry: number, n = 28): [number, number][] => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * rx, Math.sin((i / n) * Math.PI * 2) * ry] as [number, number]);
  switch (shape) {
    case 'oval':
      return ellipse(0.62, 0.9);
    case 'long':
      return ellipse(0.36, 1.2);
    case 'diamond':
      return [[0.92, 0.05], [0, 1.05], [-0.92, 0.05], [0, -1.05]];
    case 'slab':
      return [[0.86, 0], [0.86, 0.78], [-0.86, 0.78], [-0.86, 0], [-0.8, -0.82], [0.8, -0.82]];
    case 'crest':
      return [[0.72, -0.25], [0.72, 0.3], [0, 1.3], [-0.72, 0.3], [-0.72, -0.25], [-0.42, -0.82], [0, -0.95], [0.42, -0.82]];
    case 'horned':
      return [[0.5, 0], [0.38, 0.4], [1.0, 1.3], [0.2, 0.6], [-0.2, 0.6], [-1.0, 1.3], [-0.38, 0.4], [-0.5, 0], [-0.32, -0.6], [0, -0.9], [0.32, -0.6]];
    case 'sun':
      return Array.from({ length: 16 }, (_, i) => {
        const r = i % 2 ? 0.5 : 1.0;
        const a = (i / 16) * Math.PI * 2 + Math.PI / 2;
        return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
      });
    case 'heart':
      // The usual heart curve, widened, traced anticlockwise from its right side.
      return Array.from({ length: 36 }, (_, i) => {
        const t = Math.PI / 2 - (i / 36) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [(x / 16) * 0.98, (y + 2.5) / 15.5] as [number, number];
      });
  }
}

/** How far the outline reaches from the middle in direction `theta`. */
export function outlineRadius(outline: [number, number][], theta: number): number {
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  let best = 0;
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i]!;
    const [bx, by] = outline[(i + 1) % outline.length]!;
    const ex = bx - ax;
    const ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den;
    const u = (ax * dy - ay * dx) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}

/** A small number that says how different two masks look: shapes, emblems and accents all differ. Two seats are never alike on all three. */
export function maskDistance(a: MaskDesign, b: MaskDesign): number {
  return (a.shape === b.shape ? 0 : 1) + (a.emblem === b.emblem ? 0 : 1) + (a.colour === b.colour ? 0 : 1);
}
