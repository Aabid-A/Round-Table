import { lazy, Suspense, useState, type ReactNode } from 'react';
import { SceneBoundary, type RoomChoice } from '../scene/host.js';
import type { WorldView } from '../scene/world.js';

const RoomScene = lazy(() => import('../scene/RoomScene.js'));

interface Props {
  view: WorldView;
  choice: RoomChoice;
  /** The flat room, shown instead when the 3D room cannot or should not be shown. */
  fallback: ReactNode;
  /** A figure selected in the room: chosen for this turn (confirmed with the button or Enter). */
  onPick: (seat: number) => void;
  label: string;
}

/** A live seat in the 3D room: your own chair, the figures you may choose lifting under the pointer, your turn's time on the table. */
export function LiveRoom({ view, choice, fallback, onPick, label }: Props) {
  const { room, quality, onFrame, onLost } = choice;
  const [hovered, setHovered] = useState<number | null>(null);
  if (!room) return <>{fallback}</>;
  return (
    <div className="world-room" data-testid="world" role="group" aria-label={label} data-figures={view.figures.filter((f) => f.present).length} data-quality={quality} data-first={view.you !== null} data-choosable={view.choosable.length} data-selected={view.selected ?? ''} data-sleep={view.sleep ? 'asleep' : ''} data-proposals={(view.proposals ?? []).reduce((n, p) => n + p.count, 0)} data-timer={view.timer ? 'shown' : ''}>
      <SceneBoundary fallback={fallback} onError={onLost}>
        <Suspense fallback={<p className="notice" role="status">Lighting the candles…</p>}>
          <RoomScene view={{ ...view, hovered: view.choosable.includes(hovered ?? -1) ? hovered : null }} quality={quality} onFrame={onFrame} onLost={onLost} onHover={setHovered} onPick={onPick} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
