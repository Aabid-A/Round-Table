import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import './room.css';
import { chordBetween, degrees, nearestAngle } from './camera.js';
import type { SceneSeat, SceneView } from './view.js';

interface Props {
  view: SceneView;
  /** Called when a seat is clicked or chosen with the keyboard. Omit for a room that only shows. */
  onSit?: (name: string) => void;
  /** Called when a seat is chosen for the turn the view is asking about (view.picking), or null to clear the choice. */
  onPick?: (name: string | null) => void;
  /** Names the room for people using a screen reader. */
  label?: string;
}

function roleText(seat: SceneSeat): string | null {
  if (seat.role === null) return null;
  return seat.role === 'traitor' ? 'Traitor' : 'Faithful';
}

/**
 * The room, in CSS 3D: a table, a chair for each seat, a camera that sits in one chair, and a light that goes dark at night.
 * It draws only the `SceneView` it is given.
 */
export function Room({ view, onSit, onPick, label = 'The room' }: Props) {
  const n = view.seats.length;
  const focusIndex = view.seats.findIndex((s) => s.name === view.camera.focus);
  const turn = useRef(0);
  turn.current = nearestAngle(turn.current, focusIndex >= 0 && !view.camera.wide ? degrees(focusIndex, n) : 0);
  const speakerIndex = view.seats.findIndex((s) => s.name === view.moment.speaker);
  const first = view.pov === 'first';
  const picking = view.picking ?? null;
  // Where a seat sits across the room as the camera sees it, so the others can turn toward whoever speaks.
  const screenX = (i: number): number => Math.sin(((i - Math.max(0, focusIndex)) / n) * 2 * Math.PI);
  const leanIndex = view.leanTo ? view.seats.findIndex((s) => s.name === view.leanTo) : -1;
  const proposalsFor = (name: string): string[] => (view.proposals ?? []).filter((p) => p.target === name).map((p) => p.by);
  const onSeatKeys = (e: KeyboardEvent<HTMLUListElement>): void => {
    if (e.key === 'Escape' && picking) {
      onPick?.(null);
      return;
    }
    // Walking the seats with the arrows is for choosing a seat. Anywhere else (the replay page) the arrows still step the game.
    if (!picking || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const chairs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button.room-chair:not([disabled])')];
    const at = chairs.indexOf(document.activeElement as HTMLButtonElement);
    if (chairs.length === 0) return;
    e.preventDefault();
    e.stopPropagation(); // the replay page's arrows step through the game; here they walk the seats
    chairs[(at + (e.key === 'ArrowRight' ? 1 : -1) + chairs.length) % chairs.length]!.focus();
  };

  return (
    <div
      className="room"
      data-testid="room"
      data-night={view.night}
      data-viewer={view.viewer ?? ''}
      data-wide={view.camera.wide}
      data-cut={view.camera.cut}
      data-focus={view.camera.focus ?? ''}
      data-pov={view.pov ?? 'third'}
      data-sleep={view.sleep === true}
      role="group"
      aria-label={label}
    >
      <div className="room-light" aria-hidden="true" />
      <div className="room-camera" inert={view.sleep === true}>
        <div className="room-stage" style={{ '--turn': `${turn.current}deg` } as CSSProperties}>
          <div className="room-table" aria-hidden="true" />
          <ul className="room-seats" aria-label="Seats" onKeyDown={onSeatKeys}>
            {view.seats.map((seat, i) => {
              if (first && seat.mark === 'self') return null; // you are the camera, not a chair in the picture
              const speaking = i === speakerIndex;
              const role = roleText(seat);
              const chair = (
                <>
                  <span className="room-name">{seat.name}</span>
                  <span className="room-model">{seat.model}</span>
                  {seat.mark === 'self' && <span className="room-tag">You</span>}
                  {seat.mark === 'fellow' && <span className="room-tag" data-role="traitor">Fellow traitor</span>}
                  {role && seat.mark === 'self' && <span className="room-tag" data-role={seat.role}>{role}</span>}
                  {seat.status !== 'alive' && <span className="room-tag" data-out="true">{seat.status === 'murdered' ? 'Murdered' : 'Banished'}</span>}
                </>
              );
              return (
                <li
                  key={seat.name}
                  className="room-seat"
                  data-testid="room-seat"
                  data-name={seat.name}
                  data-status={seat.status}
                  data-mark={seat.mark ?? ''}
                  data-speaking={speaking}
                  data-leaning={view.whispers.some((w) => w.from === seat.name && w.to === view.viewer)}
                  data-picked={picking?.picked === seat.name}
                  style={{ '--angle': `${degrees(i, n)}deg`, '--lean': `${leanIndex >= 0 && i !== leanIndex ? Math.max(-1, Math.min(1, (screenX(leanIndex) - screenX(i)) * 1.5)) * 16 : 0}deg` } as CSSProperties}
                >
                  <div className="room-stand">
                    {proposalsFor(seat.name).map((by) => (
                      <span key={by} className="room-proposal" data-testid="room-proposal">
                        {by} proposes
                      </span>
                    ))}
                    {role && seat.mark !== 'self' && seat.mark !== 'fellow' && (
                      <span className="room-flag" data-role={seat.role} data-testid="room-role">
                        {role}
                      </span>
                    )}
                    {onSit || (picking && onPick) ? (
                      <button
                        type="button"
                        className="room-chair"
                        disabled={picking !== null && !picking.options.includes(seat.name)}
                        data-empty={seat.status !== 'alive'}
                        aria-pressed={picking ? picking.picked === seat.name : seat.name === view.viewer}
                        aria-label={`${picking ? 'Choose ' : seat.mark === 'self' ? 'You are ' : 'Sit at '}${seat.name}${seat.status === 'alive' ? '' : `, ${seat.status}`}${role && seat.mark !== 'self' ? `, ${seat.role}` : ''}`}
                        onClick={() => (picking ? onPick?.(picking.picked === seat.name ? null : seat.name) : onSit?.(seat.name))}
                      >
                        {chair}
                      </button>
                    ) : (
                      <div className="room-chair" data-self={seat.mark === 'self'} data-empty={seat.status !== 'alive'}>
                        {chair}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="room-links" aria-hidden="true">
            {/* From your own chair a whisper to you is the sender leaning in, not a line across the table. */}
            {(first ? [] : view.whispers).map((w) => {
              const a = view.seats.findIndex((x) => x.name === w.from);
              const b = view.seats.findIndex((x) => x.name === w.to);
              if (a < 0 || b < 0) return null;
              const { mid, dist, len } = chordBetween(a, b, n);
              return (
                <div key={`${w.from}>${w.to}`} className="room-link" data-testid="room-whisper" style={{ '--mid': `${mid}deg`, '--dist': dist, '--len': len } as CSSProperties}>
                  <span className="room-link-line" />
                  <span className="room-link-text">
                    <b>{w.from}</b> to <b>{w.to}</b>: {w.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {speakerIndex >= 0 && view.moment.text && (
        <div className="room-talk">
          <p className="room-speech" data-kind={view.moment.kind} data-testid="room-speech">
            <span className="room-who">{view.moment.kind === 'thought' ? 'Your thoughts' : view.moment.speaker}</span>
            {view.moment.text}
          </p>
          {view.moment.thought && (
            <p className="room-thought" data-testid="room-thought">
              <span className="room-who">Private notes</span>
              {view.moment.thought}
            </p>
          )}
        </div>
      )}
      {view.timer && (
        <div className="room-timer" data-testid="room-timer" data-low={view.timer.leftMs <= 10_000} role="timer" aria-label="Time left for your turn">
          <span className="room-timer-bar" style={{ width: `${Math.max(0, Math.min(100, (view.timer.leftMs / view.timer.totalMs) * 100))}%` }} />
          <span className="room-timer-text">
            {view.timer.leftMs <= 10_000 ? 'Hurry: ' : ''}
            {Math.ceil(view.timer.leftMs / 1000)}s
          </span>
        </div>
      )}
      {view.sleep && (
        <div className="room-sleep" data-testid="room-sleep">
          <p>Night. You are asleep.</p>
        </div>
      )}
      <div className="room-caption" data-testid="room-caption">
        <p className="room-kicker">
          {view.moment.title}
          {view.moment.round !== null && ` · Round ${view.moment.round}`}
        </p>
        {view.moment.text && !(speakerIndex >= 0) && <p className="room-line">{view.moment.text}</p>}
      </div>
    </div>
  );
}
