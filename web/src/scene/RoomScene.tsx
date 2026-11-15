import { SceneCanvas } from './SceneCanvas.js';
import type { Quality } from './stage/quality.js';
import type { WorldView } from './world.js';
import { World } from './World.js';

interface Props {
  view: WorldView;
  quality: Quality;
  onFrame?: (ms: number) => void;
  onLost?: () => void;
  onHover?: (seat: number | null) => void;
  onPick?: (seat: number) => void;
}

/** The 3D room for any mode: a SceneCanvas with the World in it. Loaded on its own, so pages without the room stay light. */
export default function RoomScene({ view, quality, onFrame, onLost, onHover = () => {}, onPick = () => {} }: Props) {
  return (
    <SceneCanvas quality={quality} onFrame={onFrame} onLost={onLost}>
      <World view={view} quality={quality} onHover={onHover} onPick={onPick} />
    </SceneCanvas>
  );
}
