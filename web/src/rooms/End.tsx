import { useMemo, useState } from 'react';
import type { GameLog } from '../../../src/engine/types.js';
import { saveBlob } from '../download.js';
import { finalRoles } from '../replay/timeline.js';
import { END_REASONS, WINNER } from '../result.js';
import type { Identity } from './state.js';

interface Props {
  me: Identity;
  log: GameLog;
  onLeave: () => void;
}

/** The game is over: who won, who was who, and the log to keep. */
export function End({ me, log, onLeave }: Props) {
  const roles = useMemo(() => finalRoles(log), [log]);
  const [saved, setSaved] = useState<string | null>(null);
  const r = log.result;
  const reason = r.reason === 'cost_cap' ? "The host's spend cap stopped the game." : (END_REASONS[r.reason] ?? r.reason);

  return (
    <main className="app play" data-testid="room-end">
      <header className="topbar">
        <h1>{r.winner === null ? 'Game stopped' : WINNER[r.winner]}</h1>
        <span className="muted">
          {reason} · {r.rounds} round{r.rounds === 1 ? '' : 's'}
        </span>
      </header>
      {r.costCap && (
        <p className="notice" role="status">
          Spent ${r.costCap.spentUsd} of the ${r.costCap.maxUsd} cap.
        </p>
      )}

      <h2>Who was who</h2>
      <ul className="result-list" aria-label="Everyone's role" data-testid="reveal">
        {log.cast.map((c) => (
          <li key={c.name}>
            <strong>{c.name}</strong>
            {c.name === me.you ? ' (you)' : ''} · {roles[c.name] === 'traitor' ? 'Traitor' : 'Faithful'}
            <br />
            <span className="muted">{c.model === 'human' ? 'A person' : c.model === 'mock' ? 'A practice AI' : c.model}</span>
          </li>
        ))}
      </ul>

      <div className="controls-row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            saveBlob(new Blob([`${JSON.stringify(log, null, 2)}\n`], { type: 'application/json' }), `round-table-room-seed-${log.seed}.json`);
            setSaved('Log saved.');
          }}
        >
          Download the game log
        </button>
        <button type="button" className="btn btn-primary" onClick={onLeave}>
          Back to the start
        </button>
      </div>
      <p className="hint" role="status" data-testid="end-note">
        {saved ?? ''}
      </p>
    </main>
  );
}
