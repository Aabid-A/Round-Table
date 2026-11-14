import { lazy, Suspense, useState, type ReactNode } from 'react';
import { SceneBoundary, useRoomChoice } from '../scene/host.js';
import type { WorldView } from '../scene/world.js';

const RoomScene = lazy(() => import('../scene/RoomScene.js'));

interface Props {
  view: WorldView;
  /** The flat page, shown instead when the room cannot or should not be shown (see useRoomChoice). */
  fallback: ReactNode;
  /** Clicking a figure sits the viewer in that seat. */
  onSit: (seat: number) => void;
  label: string;
}

/** The replay in the 3D room. Every figure but the viewer's own can be clicked to sit in that seat; the keys and the View list still work. */
export function ReplayRoom({ view, fallback, onSit, label }: Props) {
  const { room, quality, onFrame, onLost } = useRoomChoice(window.location.search);
  const [hovered, setHovered] = useState<number | null>(null);
  if (!room) return <>{fallback}</>;
  const choosable = view.figures.filter((f) => f.index !== view.you).map((f) => f.index);
  return (
    <div className="world-room" data-testid="world" role="group" aria-label={label} data-figures={view.figures.filter((f) => f.present).length} data-quality={quality} data-first={view.you !== null}>
      <SceneBoundary fallback={fallback}>
        <Suspense fallback={<p className="notice" role="status">Lighting the candles…</p>}>
          <RoomScene view={{ ...view, choosable, hovered: choosable.includes(hovered ?? -1) ? hovered : null }} quality={quality} onFrame={onFrame} onLost={onLost} onHover={setHovered} onPick={onSit} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
