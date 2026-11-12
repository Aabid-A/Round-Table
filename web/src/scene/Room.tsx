import { useRef, type CSSProperties } from 'react';
import './room.css';
import { chordBetween, degrees, nearestAngle } from './camera.js';
import type { SceneSeat, SceneView } from './view.js';

interface Props {
  view: SceneView;
  /** Called when a seat is clicked or chosen with the keyboard. Omit for a room that only shows. */
  onSit?: (name: string) => void;
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
export function Room({ view, onSit, label = 'The room' }: Props) {
  const n = view.seats.length;
  const focusIndex = view.seats.findIndex((s) => s.name === view.camera.focus);
  const turn = useRef(0);
  turn.current = nearestAngle(turn.current, focusIndex >= 0 && !view.camera.wide ? degrees(focusIndex, n) : 0);
  const speakerIndex = view.seats.findIndex((s) => s.name === view.moment.speaker);

  return (
    <div
      className="room"
      data-testid="room"
      data-night={view.night}
      data-viewer={view.viewer ?? ''}
      data-wide={view.camera.wide}
      data-cut={view.camera.cut}
      data-focus={view.camera.focus ?? ''}
      role="group"
      aria-label={label}
    >
      <div className="room-light" aria-hidden="true" />
      <div className="room-camera">
        <div className="room-stage" style={{ '--turn': `${turn.current}deg` } as CSSProperties}>
          <div className="room-table" aria-hidden="true" />
          <ul className="room-seats" aria-label="Seats">
            {view.seats.map((seat, i) => {
              const speaking = i === speakerIndex;
              const role = roleText(seat);
              const chair = (
                <>
                  <span className="room-name">{seat.name}</span>
                  <span className="room-model">{seat.model}</span>
                  {seat.mark === 'self' && <span className="room-tag">You</span>}
                  {seat.mark === 'fellow' && <span className="room-tag" data-role="traitor">Fellow traitor</span>}
                  {role && seat.mark === 'self' && <span className="room-tag" data-role={seat.role}>{role}</span>}
                  {role && seat.mark !== 'self' && seat.mark !== 'fellow' && (
                    <span className="room-flag" data-role={seat.role} data-testid="room-role">
                      {role}
                    </span>
                  )}
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
                  style={{ '--angle': `${degrees(i, n)}deg` } as CSSProperties}
                >
                  {onSit ? (
                    <button
                      type="button"
                      className="room-chair"
                      aria-pressed={seat.name === view.viewer}
                      aria-label={`${seat.mark === 'self' ? 'You are ' : 'Sit at '}${seat.name}${seat.status === 'alive' ? '' : `, ${seat.status}`}`}
                      onClick={() => onSit(seat.name)}
                    >
                      {chair}
                    </button>
                  ) : (
                    <div className="room-chair" data-self={seat.mark === 'self'}>
                      {chair}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="room-links" aria-hidden="true">
            {view.whispers.map((w) => {
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
