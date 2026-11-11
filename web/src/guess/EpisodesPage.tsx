import { useEffect, useState } from 'react';
import './guess.css';
import type { EpisodeEntry, EpisodeIndex } from '../../../src/log/episodes.js';
import { pickEpisode } from './episodes.js';
import { loadEpisodeIndex } from './loadIndex.js';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; index: EpisodeIndex };

const guessUrl = (e: EpisodeEntry): string => `?mode=guess&log=${encodeURIComponent(e.name)}&episode=${e.number}`;

/** The list of episodes to play, and a link to today's. */
export function EpisodesPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    document.title = 'Round Table episodes';
    void loadEpisodeIndex(import.meta.env.BASE_URL).then((r) => setState(r.ok ? { kind: 'ready', index: r.index } : { kind: 'error', message: r.message }));
  }, []);

  return (
    <main className="loader episodes">
      <h1>Guess the traitor</h1>
      <p className="muted">
        Watch an episode and pick who you think the traitors are after each round table. Roles and private notes stay hidden until
        the end.
      </p>
      {state.kind === 'loading' && (
        <p className="notice" role="status">
          Loading the episodes…
        </p>
      )}
      {state.kind === 'error' && (
        <p className="notice notice-error" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === 'ready' && state.index.episodes.length === 0 && (
        <p className="notice" role="status">
          No episodes yet. Copy game logs into <code>web/public/games/</code> and run <code>npm run episodes -- web/public/games</code>.
        </p>
      )}
      {state.kind === 'ready' && state.index.episodes.length > 0 && (
        <>
          <p>
            <a className="btn btn-primary" href="?mode=guess&episode=today">
              Play today&rsquo;s episode
            </a>
            <span className="muted"> (episode {pickEpisode(state.index, { kind: 'today' }, new Date())?.number})</span>
          </p>
          <ol className="episode-list" aria-label="Episodes">
            {state.index.episodes.map((e) => (
              <li key={e.name}>
                <a href={guessUrl(e)}>
                  <strong>Episode {e.number}</strong>
                  <span className="muted">
                    {' '}
                    · {e.players} players · {e.traitors} traitors · {e.rounds} round{e.rounds === 1 ? '' : 's'}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
