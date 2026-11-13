import { ACCENTS } from '../palette.js';

/** The shape of a mask's face, told apart before colour is: see /art-direction ("mask shape, then colour, then name plate"). */
export type MaskShape = 'oval' | 'crest' | 'sun' | 'diamond' | 'shield' | 'long' | 'horned' | 'round';

/** The small emblem on the brow, a second shape cue that does not depend on colour. */
export type Emblem = 'star' | 'ring' | 'bar' | 'dots' | 'cross' | 'drop' | 'wave' | 'tri';

export interface MaskDesign {
  shape: MaskShape;
  emblem: Emblem;
  colour: string;
}

/** Eight masks, one per seat: eight different shapes, eight different emblems and eight different accents. */
export const MASKS: readonly MaskDesign[] = [
  { shape: 'oval', emblem: 'star', colour: ACCENTS[0] },
  { shape: 'crest', emblem: 'ring', colour: ACCENTS[1] },
  { shape: 'sun', emblem: 'bar', colour: ACCENTS[2] },
  { shape: 'diamond', emblem: 'dots', colour: ACCENTS[3] },
  { shape: 'shield', emblem: 'cross', colour: ACCENTS[4] },
  { shape: 'long', emblem: 'drop', colour: ACCENTS[5] },
  { shape: 'horned', emblem: 'wave', colour: ACCENTS[6] },
  { shape: 'round', emblem: 'tri', colour: ACCENTS[7] },
];

/**
 * The outline of a mask in a box about two units tall, centred on 0. Each is a different silhouette at a glance: an egg, a single tall
 * crest, a ring of rays, a sharp lozenge, a flat-topped shield, a narrow long face, two horns, a full disc. Every outline can be seen
 * whole from its own middle (no part hides behind another), which is what lets the mask be sculpted as one curved surface.
 */
export function maskOutline(shape: MaskShape): [number, number][] {
  const ellipse = (rx: number, ry: number, n = 28): [number, number][] => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * rx, Math.sin((i / n) * Math.PI * 2) * ry] as [number, number]);
  switch (shape) {
    case 'oval':
      return ellipse(0.62, 0.9);
    case 'round':
      return ellipse(0.86, 0.86);
    case 'long':
      return ellipse(0.42, 1.08);
    case 'diamond':
      return [[0.78, 0.05], [0, 1.05], [-0.78, 0.05], [0, -1.05]];
    case 'shield':
      return [[0.8, 0.1], [0.78, 0.9], [-0.78, 0.9], [-0.8, 0.1], [-0.5, -0.6], [0, -1], [0.5, -0.6]];
    case 'crest':
      return [[0.64, -0.2], [0.6, 0.5], [0.2, 0.62], [0, 1.12], [-0.2, 0.62], [-0.6, 0.5], [-0.64, -0.2], [-0.36, -0.8], [0, -0.98], [0.36, -0.8]];
    case 'horned':
      return [[0.6, 0.05], [0.36, 0.5], [0.75, 1.2], [0.2, 0.62], [-0.2, 0.62], [-0.75, 1.2], [-0.36, 0.5], [-0.6, 0.05], [-0.4, -0.6], [0, -0.95], [0.4, -0.6]];
    case 'sun':
      return Array.from({ length: 20 }, (_, i) => {
        const r = i % 2 ? 0.64 : 0.95;
        const a = (i / 20) * Math.PI * 2 + Math.PI / 2;
        return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
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
