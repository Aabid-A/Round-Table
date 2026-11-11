import { useEffect, useRef, useState } from 'react';
import type { PickSetup } from './score.js';

interface Props {
  setup: PickSetup;
  /** The names already locked for this round, if any. */
  locked: string[] | null;
  onLock: (names: string[]) => void;
}

/** After a round table: choose who you think the traitors are. Locked before the vote, so no changing your mind. */
export function PickPanel({ setup, locked, onLock }: Props) {
  const [chosen, setChosen] = useState<string[]>([]);
  const lockedRef = useRef<HTMLElement>(null);
  // The form disappears when you lock, taking keyboard focus with it: move focus to the message that replaces it.
  useEffect(() => {
    if (locked) lockedRef.current?.focus();
  }, [locked]);
  if (locked) {
    return (
      <section ref={lockedRef} tabIndex={-1} role="status" className="pick" aria-label={`Your picks for round ${setup.round}`} data-testid="pick-locked">
        <h2>Round {setup.round}: your picks are locked</h2>
        <p>
          You picked <strong>{locked.join(' and ')}</strong>. Now watch the vote.
        </p>
      </section>
    );
  }
  const full = chosen.length >= setup.count;
  const toggle = (name: string): void => setChosen((c) => (c.includes(name) ? c.filter((n) => n !== name) : c.length < setup.count ? [...c, name] : c));
  return (
    <form
      className="pick"
      aria-label={`Pick the traitors for round ${setup.round}`}
      data-testid="pick-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen.length === setup.count) onLock(chosen);
      }}
    >
      <fieldset>
        <legend>
          Round {setup.round}: who are the traitors? Pick {setup.count}.
        </legend>
        <div className="pick-grid">
          {setup.candidates.map((name) => {
            const on = chosen.includes(name);
            return (
              <label key={name} className="pick-option" data-on={on}>
                <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(name)} />
                {name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="hint" role="status">
        {chosen.length} of {setup.count} picked.{full ? '' : ` Pick ${setup.count - chosen.length} more to lock.`}
      </p>
      <button type="submit" className="btn btn-primary" disabled={chosen.length !== setup.count}>
        Lock my picks
      </button>
    </form>
  );
}
