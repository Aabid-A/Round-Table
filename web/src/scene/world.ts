import type { Role } from '../../../src/types.js';

/** One seat at the round table. `revealed` is the role only once the game has shown it (a banishment, a dawn); otherwise null, and nothing in the scene can know it. */
export interface WorldFigure {
  index: number;
  name: string;
  /** Which of the eight masks (see models/masks.ts). */
  mask: number;
  present: boolean;
  revealed: Role | null;
  /** A fellow traitor this viewer was told about: their plate is edged in traitor red. Only ever set for a viewer who is a traitor. */
  fellow?: boolean;
}

export type WorldMood = 'day' | 'night' | 'dawn';

/** The banishment as it is staged: the chair is pushed back, the figure leaves, the mask is turned over, then it is quiet. */
export interface WorldBanish {
  seat: number;
  stage: 'pushback' | 'leave' | 'mask' | 'done';
  /** Shown only from the stage in which the mask is turned over. */
  role: Role | null;
}

/**
 * Everything the WebGL room draws and nothing else, so it never reads the game, a log or a room's state; whoever builds it decides
 * what this viewer may see. The scene eases toward
 * this; moving from one view to the next is animation, never a jump.
 */
export interface WorldView {
  figures: WorldFigure[];
  /** The seat the camera sits in, in the first person. Null: the room is seen from no chair, through a director's camera. */
  you: number | null;
  /** Seen from no chair: where the director's camera looks (the seat holding the moment) and whether it pulls back or cuts. */
  shot?: { focus: number | null; wide: boolean; cut: boolean };
  mood: WorldMood;
  /** How many candles are lit (the rest have been snuffed). */
  candlesLit: number;
  speaker: number | null;
  speech: { text: string; speaker: number } | null;
  /** A hand pointing: who points at whom. */
  pointing: { from: number; at: number } | null;
  /** Whom each figure looks toward, by seat (null looks at the table). */
  looks: (number | null)[];
  /** The table is voting (choosing, or the tokens sliding): the camera takes in the whole table. */
  voting: boolean;
  /** Tokens slid toward a name on the table. */
  tokens: { owner: number; target: number }[];
  banish: WorldBanish | null;
  dawn: { victim: number; role: Role | null } | null;
  /** Seats the player may choose right now, and the one hovered and chosen. */
  choosable: number[];
  hovered: number | null;
  selected: number | null;
  /** A whisper reaching the viewer (or seen by one who sees whispers): the sender leans toward the one it is for and the room dims. */
  whisper?: { from: number; to: number } | null;
  /** A recruitment: in the dark a second mask is slid across the table from the traitor to the one offered it. */
  recruit?: { from: number; to: number } | null;
  /** Players already out of the game, by seat: their masks lie on the table before their empty chairs, turned over when the role is known. */
  fallen?: { seat: number; role: Role | null }[];
  /** Words for the HUD and the live region: what is happening and what the player may do. Only what this viewer may know. */
  announce: string;
}

export const CANDLES = 6;
