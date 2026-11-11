import { useMemo, useState } from 'react';
import type { GameLog } from '../../../src/engine/types.js';
import { finalRoles } from '../replay/timeline.js';
import { resultCardAlt, resultCardPng } from './resultCard.js';
import { emojiRow, missedMoments, shareText, type GuessScore } from './score.js';

interface Props {
  log: GameLog;
  score: GuessScore;
  episode: number | null;
  /** The link a shared result points to. */
  link: string;
  onAgain: () => void;
}

const MARK = { all: '✓ every traitor found', some: '~ some found', none: '✗ none found' } as const;

/** The end: your score, the reveal, what you missed, and a result to share that spoils nothing. */
export function ScorePage({ log, score, episode, link, onAgain }: Props) {
  const roles = useMemo(() => finalRoles(log), [log]);
  const missed = useMemo(() => missedMoments(log, score), [log, score]);
  const text = shareText(score, episode, link);
  const [note, setNote] = useState<string | null>(null);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Copied.');
    } catch {
      setNote('Could not copy automatically. Select the text above and copy it.');
    }
  };
  const download = async (): Promise<void> => {
    try {
      const url = URL.createObjectURL(await resultCardPng(score, episode));
      const a = document.createElement('a');
      a.href = url;
      a.download = `round-table-${episode ?? 'guess'}-result.png`;
      a.click();
      URL.revokeObjectURL(url);
      setNote('Card saved.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not make the card.');
    }
  };

  return (
    <section className="score" data-testid="score" aria-labelledby="score-title">
      <h2 id="score-title">
        {score.rounds.length === 0 ? 'There was nothing to guess in this episode' : `You found ${score.correct} of ${score.possible} traitor spots`}
      </h2>
      <p className="emoji-row" aria-label={resultCardAlt(score, episode)} data-testid="emoji-row">
        {emojiRow(score)}
      </p>
      <ul className="round-results" aria-label="Round by round">
        {score.rounds.map((r) => (
          <li key={r.round}>
            <strong>Round {r.round}</strong>: you picked {r.picks.length > 0 ? r.picks.join(' and ') : 'no one'}. {MARK[r.result]}.
          </li>
        ))}
      </ul>

      <h3>The reveal</h3>
      <ul className="result-list" aria-label="Everyone's role" data-testid="reveal">
        {log.cast.map((c) => (
          <li key={c.name}>
            <strong>{c.name}</strong> · {roles[c.name] === 'traitor' ? 'Traitor' : 'Faithful'}
          </li>
        ))}
      </ul>

      {missed.length > 0 && (
        <>
          <h3>What you did not see</h3>
          <p className="muted">The traitors you missed, and what they privately wrote while they spoke.</p>
          <ul className="missed" data-testid="missed">
            {missed.map((m) => (
              <li key={`${m.round}-${m.player}`}>
                <strong>
                  {m.player} · round {m.round}
                </strong>
                <span className="missed-said">Said: {m.said}</span>
                <span className="notes">
                  <strong>Thought, hidden from the players</strong>
                  {m.thought}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Share</h3>
      <p className="muted">This names no one and gives nothing away.</p>
      <pre className="share-text" data-testid="share-text">
        {text}
      </pre>
      <div className="controls-row">
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>
          Copy result
        </button>
        <button type="button" className="btn" onClick={() => void download()}>
          Download card
        </button>
        <button type="button" className="btn" onClick={onAgain}>
          Watch again
        </button>
        <a className="btn" href="?page=episodes">
          More episodes
        </a>
      </div>
      <p className="hint" role="status" data-testid="share-note">
        {note ?? ''}
      </p>
    </section>
  );
}
