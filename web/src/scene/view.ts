import type { Role } from '../../../src/types.js';

export type SeatStatus = 'alive' | 'murdered' | 'banished';

/** `self` is the chair the viewer sits in; `fellow` is a fellow traitor the viewer was told about. */
export type SeatMark = 'self' | 'fellow';

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
  kind: 'speech' | 'thought' | 'event' | 'none';
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
}
