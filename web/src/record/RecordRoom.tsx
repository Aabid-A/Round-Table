import { lazy, Suspense, type ReactNode } from 'react';
import { BANISH_BEAT_MS, BANISH_BEATS, banishWords, worldFromScene } from '../scene/fromScene.js';
import { SceneBoundary, useBeat, type RoomChoice } from '../scene/host.js';
import type { SceneView } from '../scene/view.js';

const RoomScene = lazy(() => import('../scene/RoomScene.js'));

interface Props {
  scene: SceneView;
  /** What the step says (the caption in the room and the live region). */
  said: string;
  /** Names the step, so a banishment is staged from its first beat each time the clip reaches it. */
  stepKey: string;
  choice: RoomChoice;
  /** The flat room, shown instead when the 3D room cannot or should not be shown. */
  fallback: ReactNode;
  label: string;
  /** Words for the room's caption when they differ from what the live region says (the all-seeing room draws its notes). */
  caption?: string;
}

/**
 * One camera of the clip: the room drawn from the scene view alone, with no controls and nothing laid over it. A seat's view sits
 * in that chair; a view with no chair is filmed by the director.
 */
export function RecordRoom({ scene, said, stepKey, choice, fallback, label, caption }: Props) {
  const beat = useBeat(scene.stage?.kind === 'banish' ? stepKey : null, BANISH_BEATS.length, BANISH_BEAT_MS);
  if (!choice.room) return <>{fallback}</>;
  const banish = scene.stage?.kind === 'banish';
  const built = worldFromScene(scene, scene.stage?.kind === 'banish' ? banishWords(scene.stage.seat, beat, said) : said, beat);
  const world = caption !== undefined && !banish ? { ...built, caption } : built;
  return (
    <div className="rec-world" data-testid="world" role="img" aria-label={label} data-first={world.you !== null} data-figures={world.figures.filter((f) => f.present).length} data-roles={world.figures.filter((f) => f.present && f.known).length} data-quality={choice.quality}>
      <SceneBoundary fallback={fallback} onError={choice.onLost}>
        <Suspense fallback={null}>
          <RoomScene view={world} quality={choice.quality} onFrame={choice.onFrame} onLost={choice.onLost} />
        </Suspense>
      </SceneBoundary>
      <p className="sr-only" role="status" aria-live="polite">
        {world.announce}
      </p>
    </div>
  );
}
