import { lazy, Suspense, type ReactNode } from 'react';
import { SceneBoundary, type RoomChoice } from '../scene/host.js';
import type { WorldView } from '../scene/worldView.js';

const RoomScene = lazy(() => import('../scene/RoomScene.js'));

/** A room with no game being chosen in: the title, the setup, the end. Nothing in it can be clicked. */
export function HallRoom({ view, choice, fallback = null }: { view: WorldView; choice: RoomChoice; fallback?: ReactNode }) {
  return (
    <div className="world-room" data-testid="world" aria-hidden="true" data-first={view.you !== null}>
      <SceneBoundary fallback={fallback} onError={choice.onLost}>
        <Suspense fallback={null}>
          <RoomScene view={view} quality={choice.quality} onFrame={choice.onFrame} onLost={choice.onLost} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
