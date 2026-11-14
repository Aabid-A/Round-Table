import { SceneCanvas } from './SceneCanvas.js';
import type { Quality } from './stage/quality.js';
import type { WorldView } from './world.js';
import { World } from './World.js';

interface Props {
  view: WorldView;
  quality: Quality;
  onHover?: (seat: number | null) => void;
  onPick?: (seat: number) => void;
  /** Called with the time each frame took, so the page can choose a level and report a frame rate. */
  onFrame?: (ms: number) => void;
  /** The viewer asked for reduced motion: cuts and fades, no idle movement. */
  reducedMotion?: boolean;
  /** The graphics context was lost (the tab was starved, the driver reset): the page should show the plain version. */
  onLost?: () => void;
}

/** The slice's WebGL scene. It draws the view it is given and nothing else; the page owns the game. */
export default function SliceScene({ view, quality, onFrame, onHover = () => {}, onPick = () => {}, reducedMotion = false, onLost }: Props) {
  return (
    <SceneCanvas quality={quality} onFrame={onFrame} reducedMotion={reducedMotion} onLost={onLost}>
      <World view={view} quality={quality} onHover={onHover} onPick={onPick} />
    </SceneCanvas>
  );
}
