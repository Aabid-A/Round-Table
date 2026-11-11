import type { GameLog } from '../../src/engine/types.js';
import type { Seat } from './replay/timeline.js';

interface Props {
  log: GameLog;
  seats: Seat[];
  onRestart: () => void;
}

const outcome = (s: Seat): string =>
  s.status === 'alive' ? 'Survived' : s.status === 'murdered' ? 'Murdered' : 'Banished';

/** The last screen: who won, why, and every player's role. */
export function ResultScreen({ log, seats, onRestart }: Props) {
  const r = log.result;
  return (
    <section className="result" data-testid="result" aria-labelledby="result-title">
      <h2 id="result-title">{r.winner === null ? 'No winner' : `The ${r.winner}s win`}</h2>
      <p className="muted">
        {r.reason.replace(/_/g, ' ')} · {r.rounds} round{r.rounds === 1 ? '' : 's'}
      </p>
      <ul className="result-list" aria-label="Everyone's role">
        {seats.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> · {s.revealedRole === 'traitor' ? 'Traitor' : 'Faithful'}
            <br />
            <span className="muted">{outcome(s)}</span>
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Watch again
        </button>
      </div>
    </section>
  );
}
