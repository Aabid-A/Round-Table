import type { Role } from '../../../src/types.js';

export type SeatStatus = 'alive' | 'murdered' | 'banished';

/** `self` is the chair the viewer sits in; `fellow` is a fellow traitor the viewer was told about; `traitor` marks a traitor for a viewer who sees every role. */
export type SeatMark = 'self' | 'fellow' | 'traitor';

export interface SceneSeat {
  name: string;
  model: string;
  status: SeatStatus;
  /** The role this viewer may know. Null means hidden from them. */
  role: Role | null;
  mark: SeatMark | null;
}

/** What is happening right now, as far as this viewer may see it. */
export interface SceneMoment {
  title: string;
  round: number | null;
  /** The seat that is speaking or thinking. */
  speaker: string | null;
  text: string | null;
  /** The speaker's private notes, shown beside what they said. Only a viewer who may see everyone's notes gets this. */
  thought: string | null;
  kind: 'speech' | 'thought' | 'event' | 'none';
}

/** A whisper drawn as a line between two seats, with its text. Only a viewer who may see whispers between others gets these. */
export interface SceneWhisper {
  from: string;
  to: string;
  text: string;
}

/** A traitor's proposal for the night, shown on the seat it names, to the traitor who may see it. */
export interface SceneProposal {
  by: string;
  target: string;
}

/** A live player's turn counting down, drawn in the room. */
export interface SceneTimer {
  leftMs: number;
  totalMs: number;
}

/** Seats the player may choose on this turn, and the one chosen so far. Choosing is done in the room; the form is the alternative. */
export interface ScenePicking {
  options: string[];
  picked: string | null;
}

/** Where the camera looks. */
export interface SceneCamera {
  /** The seat the camera turns to. Null looks at the table from the front. */
  focus: string | null;
  /** Pull back to see the whole table, for votes and reveals. */
  wide: boolean;
  /** Jump to the new shot instead of gliding (a director's cut). */
  cut: boolean;
}

/**
 * Everything the scene draws, and nothing else. The scene never reads a game log or room state: whoever builds this object
 * decides what the viewer may see, and anything not listed here cannot reach the screen.
 */
export interface SceneView {
  /** Whose chair the camera sits in. Null for no chair: the camera looks at the whole table. */
  viewer: string | null;
  seats: SceneSeat[];
  moment: SceneMoment;
  /** True during the night phase: the room goes dark. */
  night: boolean;
  whispers: SceneWhisper[];
  camera: SceneCamera;
  /** 'first': the camera sits in the viewer's own chair and the viewer's seat is not drawn. Default 'third'. */
  pov?: 'third' | 'first';
  /** The viewer is asleep for the night: the room goes dark and nothing is shown. */
  sleep?: boolean;
  /** The seat the other players turn toward, because it is speaking. */
  leanTo?: string | null;
  proposals?: SceneProposal[];
  timer?: SceneTimer | null;
  picking?: ScenePicking | null;
}
