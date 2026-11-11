import type { GameLog } from '../../../src/engine/types.js';
import { describeStep } from '../replay/describe.js';
import { cardTextScale, clipQuote, MAX_QUOTE_CHARS } from './fit.js';
import type { CardSize } from './params.js';

interface Props {
  log: GameLog;
  logName: string;
  turnId: number;
  size: CardSize;
}

const PHASES: Record<string, string> = {
  night: 'Night',
  whispers: 'Whispers',
  round_table: 'Round table',
  vote: 'Banishment vote',
  revote: 'Revote',
  recruit_choose: 'Recruitment',
  recruit_respond: 'Recruitment',
  endgame_vote: 'End-or-banish vote',
};

const SAID_LABEL = { speech: 'Said', whisper: 'Whispered', action: 'Did' } as const;

/** A quote card: what a player said, against what they thought. Fixed size, ready to screenshot. */
export function Card({ log, logName, turnId, size }: Props) {
  const turn = log.turns.find((t) => t.id === turnId);
  if (!turn) {
    return (
      <p className="rec-error" role="alert">
        There is no turn {turnId} in this log (it has {log.turns.length}).
      </p>
    );
  }
  const view = describeStep({ kind: 'turn', turn, section: { round: turn.round, title: '' } }, log);
  const max = MAX_QUOTE_CHARS[size];
  const kind = view.bubble?.kind ?? 'speech';
  const said = clipQuote(view.bubble?.text ?? '', max);
  const thought = clipQuote(view.notes ?? 'No private notes for this turn.', max);
  const model = log.cast.find((c) => c.name === turn.player)?.model ?? '';
  const quoteSize = { fontSize: `calc(var(--card-quote) * ${cardTextScale(Math.max(said.length, thought.length), size)})` };
  return (
    <article className="share-card" data-testid="card" data-size={size} data-footer={view.notes !== null} aria-label={`${turn.player}: said and thought`}>
      <header className="share-head">
        <span className="share-brand">Round Table</span>
        <span className="share-where" data-testid="card-where">
          Game {logName} · Round {turn.round} · {PHASES[turn.phase] ?? turn.phase}
        </span>
      </header>
      <div className="share-who">
        <h1>{turn.player}</h1>
        <p>{model}</p>
      </div>
      <div className="share-quotes">
        <figure className="share-quote share-said" data-testid="card-said">
          <figcaption data-testid="card-said-label">
            {SAID_LABEL[kind]}
            {turn.fallback ? ' · fallback: no valid reply' : ''}
          </figcaption>
          <blockquote style={quoteSize}>{said}</blockquote>
        </figure>
        <figure className="share-quote share-thought" data-testid="card-thought">
          <figcaption>Thought</figcaption>
          <blockquote style={quoteSize}>{thought}</blockquote>
        </figure>
      </div>
      {view.notes !== null && (
        <footer className="share-foot" data-testid="card-foot">
          The thought was hidden from the other players.
        </footer>
      )}
    </article>
  );
}
