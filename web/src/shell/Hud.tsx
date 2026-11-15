import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** What is happening, top left: the phase, and the round when there is one. Omit where the page draws its own. */
  phase?: string;
  round?: number | null;
  muted: boolean;
  onMute: () => void;
  /** Opens the journal (also the J key). Omit where there is no journal. */
  onJournal?: (() => void) | undefined;
  /** What the menu holds: leaving the game, the plain version, and so on. */
  menu: ReactNode;
}

/** The only things laid over the room: the phase and round top left, sound, the journal and the menu top right. The turn's time is the candle on the table. */
export function Hud({ phase, round = null, muted, onMute, onJournal, menu }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      {phase !== undefined && (
        <p className="hud-phase" data-testid="hud-phase">
          {phase}
          {round !== null && <span> · Round {round}</span>}
        </p>
      )}
      <div className="hud-bar">
        {onJournal && (
          <button type="button" className="hud-btn" onClick={onJournal} aria-keyshortcuts="J" data-testid="journal-open">
            Journal
          </button>
        )}
        <button type="button" className="hud-btn" onClick={onMute} aria-pressed={!muted} data-testid="sound">
          {muted ? 'Sound off' : 'Sound on'}
        </button>
        <button type="button" className="hud-btn" aria-expanded={open} aria-controls="hud-menu" onClick={() => setOpen((v) => !v)} data-testid="menu">
          Menu
        </button>
      </div>
      {open && (
        <div id="hud-menu" className="hud-menu" ref={panel} role="group" aria-label="Menu" onClick={(e) => (e.target as HTMLElement).closest('button, a') && setOpen(false)}>
          {menu}
        </div>
      )}
    </>
  );
}
