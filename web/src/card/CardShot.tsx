import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import type { GameLog } from '../../../src/engine/types.js';
import { describeStep } from '../replay/describe.js';
import { tableSceneView } from '../replay/tableScene.js';
import { buildSteps } from '../replay/timeline.js';
import { worldFromScene } from '../scene/fromScene.js';
import { SceneBoundary, type RoomChoice } from '../scene/host.js';

const RoomScene = lazy(() => import('../scene/RoomScene.js'));

/** Frames drawn before the picture counts as finished: the room has loaded and the director has settled on the speaker. */
export const SHOT_FRAMES = 30;

interface Props {
  log: GameLog;
  turnId: number;
  choice: RoomChoice;
  /** Called once the picture is finished, or at once when there is none to draw. */
  onReady: () => void;
}

/**
 * The card's picture: the public table at the quoted turn, filmed by the director on the one who acted. It is built from the public
 * table alone, so it shows no role that was not public at that moment.
 */
export function CardShot({ log, turnId, choice, onReady }: Props) {
  const scene = useMemo(() => {
    const steps = buildSteps(log);
    const at = steps.findIndex((s) => s.kind === 'turn' && s.turn.id === turnId);
    if (at < 0) return null;
    const view = describeStep(steps[at]!, log);
    return tableSceneView(log, steps, at, view);
  }, [log, turnId]);
  const frames = useRef(0);
  const ready = useRef(onReady);
  ready.current = onReady;
  const shown = choice.room && scene !== null;
  useEffect(() => {
    if (!shown) ready.current();
  }, [shown]);
  if (!shown || !scene) return null;
  // No words in the picture: the card quotes them beside it.
  const world = worldFromScene({ ...scene, moment: { ...scene.moment, text: null, thought: null } }, '', 0);
  const onFrame = (ms: number): void => {
    choice.onFrame(ms);
    frames.current += 1;
    if (frames.current === SHOT_FRAMES) ready.current();
  };
  return (
    <div className="share-shot-room" data-testid="card-shot" aria-hidden="true">
      <SceneBoundary fallback={null} onError={() => (choice.onLost(), ready.current())}>
        <Suspense fallback={null}>
          <RoomScene view={world} quality={choice.quality} onFrame={onFrame} onLost={() => (choice.onLost(), ready.current())} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
