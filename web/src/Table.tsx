import type { CSSProperties } from 'react';
import type { StepView } from './replay/describe.js';
import type { Seat } from './replay/timeline.js';

const RADIUS = 38; // seats sit on a circle this many percent of the table from its center
const BUBBLE_OFFSET = 0.24; // how far from the center the bubble moves toward its speaker

function angleFor(i: number, n: number): number {
  return (i / n) * Math.PI * 2 - Math.PI / 2;
}

function statusLabel(seat: Seat): string | null {
  if (seat.status === 'murdered') return 'Murdered';
  if (seat.status === 'banished') return 'Banished';
  return null;
}

interface Props {
  seats: Seat[];
  view: StepView;
}

/** Players around a table, with a speech bubble on the speaker and a card for events. */
export function Table({ seats, view }: Props) {
  const speakerIndex = seats.findIndex((s) => s.name === view.speaker);
  const a = speakerIndex >= 0 ? angleFor(speakerIndex, seats.length) : 0;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // The tail sits on the bubble's edge, on the side that faces the speaker.
  const scale = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const bubbleStyle: CSSProperties = {
    left: `${50 + dx * RADIUS * BUBBLE_OFFSET}%`,
    top: `${50 + dy * RADIUS * BUBBLE_OFFSET}%`,
  };
  const tailStyle: CSSProperties = {
    left: `${50 + (dx / scale) * 50}%`,
    top: `${50 + (dy / scale) * 50}%`,
  };

  return (
    <div className="table" data-testid="table">
      <ul className="seats" aria-label="Players">
        {seats.map((seat, i) => {
          const ang = angleFor(i, seats.length);
          const speaking = seat.name === view.speaker;
          const target = seat.name === view.target;
          const status = statusLabel(seat);
          return (
            <li
              key={seat.name}
              className="seat"
              data-status={seat.status}
              data-speaking={speaking}
              data-target={target}
              aria-current={speaking ? 'true' : undefined}
              style={{ left: `${50 + Math.cos(ang) * RADIUS}%`, top: `${50 + Math.sin(ang) * RADIUS}%` }}
            >
              <span className="seat-name" title={seat.name}>
                {seat.name}
              </span>
              <span className="seat-model" title={seat.model}>
                {seat.model}
              </span>
              {status && <span className="seat-tag">{status}</span>}
              {seat.revealedRole && (
                <span className={`seat-tag tag-${seat.revealedRole}`}>
                  {seat.revealedRole === 'traitor' ? 'Traitor' : 'Faithful'}
                </span>
              )}
              {speaking && <span className="sr-only">(speaking)</span>}
              {target && <span className="sr-only">(target)</span>}
            </li>
          );
        })}
      </ul>

      {view.bubble && view.speaker && speakerIndex >= 0 && (
        <div className="bubble" data-kind={view.bubble.kind} style={bubbleStyle} data-testid="bubble">
          <span className="bubble-who">
            {view.speaker}
            {view.bubble.kind === 'whisper' ? ' whispers' : ''}
          </span>
          {view.bubble.text}
          <span className="bubble-tail" style={tailStyle} aria-hidden="true" />
        </div>
      )}

      {view.card && (
        <div className="card" data-tone={view.card.tone} data-testid="card" role="group" aria-label={view.card.title}>
          <h2>{view.card.title}</h2>
          <p>{view.card.body}</p>
        </div>
      )}
    </div>
  );
}
