import type { GameLog } from '../../../src/engine/types.js';
import { describeStep } from '../replay/describe.js';

interface Props {
  log: GameLog;
  turnId: number;
}

/** The shot the show is built on: what a player said, beside what they privately wrote. */
export function Faces({ log, turnId }: Props) {
  const turn = log.turns.find((t) => t.id === turnId);
  if (!turn) return <p className="rec-error" role="alert">There is no turn {turnId} in this log (it has {log.turns.length}).</p>;
  const view = describeStep({ kind: 'turn', turn, section: { round: turn.round, title: '' } }, log);
  const model = log.cast.find((c) => c.name === turn.player)?.model ?? '';
  return (
    <section className="faces" data-testid="faces" aria-label={`${turn.player}: said and privately wrote`}>
      <header className="faces-head">
        <h1>{turn.player}</h1>
        <p className="muted">
          {model} · round {turn.round}
        </p>
      </header>
      <div className="faces-grid">
        <figure className="face face-said" data-testid="face-said">
          <figcaption>Said</figcaption>
          <blockquote>{view.bubble?.text ?? ''}</blockquote>
        </figure>
        <figure className="face face-wrote" data-testid="face-wrote">
          <figcaption>Wrote privately · hidden from players</figcaption>
          <blockquote>{view.notes ?? 'No private notes for this turn.'}</blockquote>
        </figure>
      </div>
    </section>
  );
}
