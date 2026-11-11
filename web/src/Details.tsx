import type { StepView } from './replay/describe.js';

interface Props {
  view: StepView;
  showNotes: boolean;
}

/** Rows, vote counts and, if switched on, the speaker's private notes. */
export function Details({ view, showNotes }: Props) {
  const hasBody = view.rows.length > 0 || view.tally.length > 0;
  const top = view.tally[0]?.count ?? 1;
  return (
    <aside className="details" aria-label="Step details">
      {view.fallback && (
        <p className="warning" role="note">
          No valid reply was given, so a fallback action was used.
        </p>
      )}
      {view.tally.length > 0 && (
        <section>
          <h3>Votes</h3>
          <ul className="tally">
            {view.tally.map((t) => (
              <li key={t.name} className="tally-row">
                <span>{t.name}</span>
                <span className="tally-bar" style={{ width: `${(t.count / top) * 100}%` }} aria-hidden="true" />
                <span>{t.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {view.rows.length > 0 && (
        <section>
          <h3>{view.tally.length > 0 ? 'Who voted for whom' : 'This step'}</h3>
          <dl className="rows">
            {view.rows.map((r, i) => (
              <div key={`${r.label}-${i}`} style={{ display: 'contents' }}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {!hasBody && !view.fallback && <p className="muted">Nothing more for this step.</p>}
      {showNotes && view.notes !== null && (
        <section className="notes" aria-label="Private notes, hidden from players" data-testid="notes">
          <strong>Hidden from players</strong>
          <p>{view.notes}</p>
        </section>
      )}
    </aside>
  );
}
