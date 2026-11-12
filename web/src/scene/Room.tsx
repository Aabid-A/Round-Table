import { useRef, type CSSProperties } from 'react';
import './room.css';
import { degrees, nearestAngle } from './camera.js';
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
    <div className="room" data-testid="room" data-night={view.night} data-viewer={view.viewer ?? ''} role="group" aria-label={label}>
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
                  {role && seat.mark !== 'fellow' && <span className="room-tag" data-role={seat.role}>{role}</span>}
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
        </div>
      </div>
      {speakerIndex >= 0 && view.moment.text && (
        <p className="room-speech" data-kind={view.moment.kind} data-testid="room-speech">
          <span className="room-who">{view.moment.kind === 'thought' ? 'Your thoughts' : view.moment.speaker}</span>
          {view.moment.text}
        </p>
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
