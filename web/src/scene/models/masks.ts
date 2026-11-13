import { ACCENTS } from '../palette.js';

/** The shape of a mask's face, told apart before colour is: see /art-direction ("mask shape, then colour, then name plate"). */
export type MaskShape = 'oval' | 'crest' | 'crescent' | 'diamond' | 'shield' | 'long' | 'horned' | 'round';

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
  { shape: 'crescent', emblem: 'bar', colour: ACCENTS[2] },
  { shape: 'diamond', emblem: 'dots', colour: ACCENTS[3] },
  { shape: 'shield', emblem: 'cross', colour: ACCENTS[4] },
  { shape: 'long', emblem: 'drop', colour: ACCENTS[5] },
  { shape: 'horned', emblem: 'wave', colour: ACCENTS[6] },
  { shape: 'round', emblem: 'tri', colour: ACCENTS[7] },
];

/** The outline of a mask in a 2-unit-tall box, centred on 0, for extruding. Each is a clearly different silhouette. */
export function maskOutline(shape: MaskShape): [number, number][] {
  const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number): [number, number][] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = from + ((to - from) * i) / n;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as [number, number];
    });
  switch (shape) {
    case 'oval':
      return arc(0, 0, 0.62, 0.9, 0, Math.PI * 2, 28).slice(0, -1);
    case 'round':
      return arc(0, 0, 0.8, 0.8, 0, Math.PI * 2, 28).slice(0, -1);
    case 'long':
      return arc(0, 0, 0.46, 1, 0, Math.PI * 2, 28).slice(0, -1);
    case 'diamond':
      return [[0, 1], [0.72, 0.1], [0.5, -0.6], [0, -1], [-0.5, -0.6], [-0.72, 0.1]];
    case 'shield':
      return [[-0.7, 0.85], [0.7, 0.85], [0.78, 0.1], [0.45, -0.62], [0, -1], [-0.45, -0.62], [-0.78, 0.1]];
    case 'crest':
      return [[-0.62, 0.55], [-0.3, 0.7], [0, 1.05], [0.3, 0.7], [0.62, 0.55], [0.66, -0.2], [0.34, -0.85], [0, -1], [-0.34, -0.85], [-0.66, -0.2]];
    case 'horned':
      return [[-0.62, 1.05], [-0.42, 0.55], [-0.62, 0.1], [-0.4, -0.6], [0, -1], [0.4, -0.6], [0.62, 0.1], [0.42, 0.55], [0.62, 1.05], [0.18, 0.72], [-0.18, 0.72]];
    case 'crescent': {
      const outer = arc(0, 0, 0.8, 0.95, Math.PI * 0.12, Math.PI * 1.88, 20);
      const inner = arc(0.34, 0, 0.5, 0.7, Math.PI * 1.7, Math.PI * 0.3, 14);
      return [...outer, ...inner];
    }
  }
}

/** A small number that says how different two masks look: shapes, emblems and accents all differ. Two seats are never alike on all three. */
export function maskDistance(a: MaskDesign, b: MaskDesign): number {
  return (a.shape === b.shape ? 0 : 1) + (a.emblem === b.emblem ? 0 : 1) + (a.colour === b.colour ? 0 : 1);
}
