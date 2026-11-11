import { useEffect, useId, useRef, useState } from 'react';
import { Clock } from './Clock.js';

interface Props {
  /** Every seat's alias, in table order. */
  seats: string[];
  /** This person's own seat: it is not one of the guesses. */
  you: string;
  timeoutMs: number;
  /** True once this person has answered; the page then waits for the others. */
  sent: boolean;
  onSubmit: (ai: string[]) => void;
}

/** After an alias game, before the reveal: which of the other seats do you think were AIs? */
export function Guess({ seats, you, timeoutMs, sent, onSubmit }: Props) {
  const id = useId();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const title = useRef<HTMLHeadingElement>(null);
  // The form is replaced when it is sent, so focus goes to the new content instead of being dropped on the page.
  useEffect(() => title.current?.focus(), [sent]);
  const others = seats.filter((s) => s !== you);

  const toggle = (seat: string): void =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(seat)) next.add(seat);
      return next;
    });

  if (sent) {
    return (
      <main className="app play" data-testid="guess-sent">
        <header className="topbar">
          <h1 ref={title} tabIndex={-1}>
            Your guess is in
          </h1>
        </header>
        <p className="notice" role="status">
          Waiting for the others to guess. The reveal comes when they have, or when the time is up.
        </p>
      </main>
    );
  }

  return (
    <main className="app play" data-testid="guess">
      <header className="topbar">
        <h1 ref={title} tabIndex={-1}>
          Human or AI?
        </h1>
        <span className="muted">You were {you}</span>
      </header>
      <p>The game is over. Before anyone is revealed: which of the other seats do you think were AIs? The rest you are calling people.</p>
      <Clock timeoutMs={timeoutMs} afterText="If it runs out, your guess is not counted." />
      <form
        className="turn"
        aria-labelledby={`${id}-legend`}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(others.filter((s) => picked.has(s)));
        }}
      >
        <fieldset className="choices">
          <legend id={`${id}-legend`}>Tick the seats you think were AIs</legend>
          {others.map((seat) => (
            <label key={seat} className="choice" data-on={picked.has(seat)}>
              <input type="checkbox" checked={picked.has(seat)} onChange={() => toggle(seat)} />
              {seat}
            </label>
          ))}
        </fieldset>
        <p className="hint" role="status" data-testid="guess-count">
          {picked.size === 0 ? 'No seats ticked: you are calling every other seat a person.' : `${picked.size} of ${others.length} seats ticked as AIs.`}
        </p>
        <button type="submit" className="btn btn-primary">
          Send my guess
        </button>
      </form>
    </main>
  );
}
