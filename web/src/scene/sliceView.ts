import type { Role } from '../../../src/types.js';

/** One seat at the round table. `revealed` is the role only once the game has shown it (a banishment, a dawn); otherwise null, and nothing in the scene can know it. */
export interface SliceFigure {
  index: number;
  name: string;
  /** Which of the eight masks (see models/masks.ts). */
  mask: number;
  present: boolean;
  revealed: Role | null;
}

export type SliceMood = 'day' | 'night' | 'dawn';

/** The banishment as it is staged: the chair is pushed back, the figure leaves, the mask is turned over, then it is quiet. */
export interface SliceBanish {
  seat: number;
  stage: 'pushback' | 'leave' | 'mask' | 'done';
  /** Shown only from the stage in which the mask is turned over. */
  role: Role | null;
}

/**
 * Everything the slice's WebGL scene draws and nothing else, so it never reads the game or its script. The scene eases toward
 * this; moving from one view to the next is animation, never a jump.
 */
export interface SliceView {
  figures: SliceFigure[];
  /** The seat the camera sits in. */
  you: number;
  mood: SliceMood;
  /** How many candles are lit (the rest have been snuffed). */
  candlesLit: number;
  speaker: number | null;
  speech: { text: string; speaker: number } | null;
  /** A hand pointing: who points at whom. */
  pointing: { from: number; at: number } | null;
  /** Whom each figure looks toward, by seat (null looks at the table). */
  looks: (number | null)[];
  /** Tokens slid toward a name on the table. */
  tokens: { owner: number; target: number }[];
  banish: SliceBanish | null;
  dawn: { victim: number; role: Role | null } | null;
  /** Seats the player may choose right now, and the one hovered and chosen. */
  choosable: number[];
  hovered: number | null;
  selected: number | null;
  /** Words for the HUD and the live region: what is happening and what the player may do. Only what this viewer may know. */
  announce: string;
}

export const CANDLES = 6;
