import { useEffect, useId, useMemo, useState } from 'react';
import './stats.css';
import { loadStatsFromFile, loadStatsFromName, statsNameFromSearch } from './load.js';
import type { SeasonStats } from './parse.js';
import { firstDirection, sortModels, type Direction, type SortKey } from './sort.js';
import type { StatsParse } from './parse.js';

type State =
  | { kind: 'loading'; what: string }
  | { kind: 'idle'; message: string | null }
  | { kind: 'ready'; stats: SeasonStats };

interface Column {
  key: SortKey;
  label: string;
  title: string;
}

const COLUMNS: Column[] = [
  { key: 'model', label: 'Model', title: 'The model' },
  { key: 'betrayalIndex', label: 'Betrayal index', title: '(wins as a traitor + faithfuls banished by its traitor vote + recruit offers accepted) / games' },
  { key: 'games', label: 'Games', title: 'Seats played' },
  { key: 'traitorWinRate', label: 'Traitor wins', title: 'Wins as a traitor / games as a traitor' },
  { key: 'faithfulWinRate', label: 'Faithful wins', title: 'Wins as a faithful / games as a faithful' },
  { key: 'caughtAsTraitor', label: 'Caught', title: 'Times banished while a traitor' },
  { key: 'faithfulsBanishedByTraitorVote', label: 'Faithfuls voted out', title: 'Faithfuls banished by this model\'s vote while a traitor' },
  { key: 'recruitOffersAccepted', label: 'Recruited', title: 'Recruit offers accepted / received' },
  { key: 'fallbackRate', label: 'Fallbacks', title: 'Share of turns with no valid reply' },
];

const pct = (n: number): string => `${Math.round(n * 100)}%`;
const ratio = (wins: number, games: number): string => (games === 0 ? 'none' : `${wins}/${games} (${pct(wins / games)})`);

/** Season stats per model: the Betrayal Index. */
export function StatsPage() {
  const inputId = useId();
  const [state, setState] = useState<State>({ kind: 'loading', what: 'stats.json' });
  const [sort, setSort] = useState<{ key: SortKey; dir: Direction }>({ key: 'betrayalIndex', dir: 'desc' });

  const settle = (r: StatsParse): void =>
    setState(r.ok ? { kind: 'ready', stats: r.stats } : { kind: 'idle', message: r.message });

  useEffect(() => {
    const name = statsNameFromSearch(window.location.search);
    setState({ kind: 'loading', what: `${name}.json` });
    void loadStatsFromName(name, import.meta.env.BASE_URL).then(settle);
  }, []);

  const rows = useMemo(() => (state.kind === 'ready' ? sortModels(state.stats.models, sort.key, sort.dir) : []), [state, sort]);
  const top = state.kind === 'ready' ? Math.max(0.0001, ...state.stats.models.map((m) => m.betrayalIndex)) : 1;

  const picker = (
    <label className="btn btn-primary file-label" htmlFor={inputId}>
      Choose a stats file
      <input
        id={inputId}
        className="file-input"
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setState({ kind: 'loading', what: file.name });
            void loadStatsFromFile(file).then(settle);
          }
          e.target.value = '';
        }}
      />
    </label>
  );

  if (state.kind !== 'ready') {
    return (
      <main className="loader">
        <h1>Season stats</h1>
        <p className="muted">
          The Betrayal Index per model. Create the file with <code>npm run stats -- games/ --out web/public/stats.json</code>.
        </p>
        {state.kind === 'loading' && (
          <p className="notice" role="status">
            Loading {state.what}…
          </p>
        )}
        {state.kind === 'idle' && state.message && (
          <p className="notice notice-error" role="alert">
            {state.message}
          </p>
        )}
        <div>{picker}</div>
      </main>
    );
  }

  const { stats } = state;
  return (
    <main className="app stats-app">
      <header className="topbar">
        <h1>Season stats</h1>
        <span className="muted">
          {stats.games} game{stats.games === 1 ? '' : 's'} ({stats.decidedGames} with a winner) · {stats.models.length} model
          {stats.models.length === 1 ? '' : 's'}
        </span>
      </header>
      {stats.models.length === 0 ? (
        <p className="notice" role="status">
          No games in these stats yet. Play some with <code>npm run games -- --mock --seeds 1-20</code>, then run{' '}
          <code>npm run stats</code> again.
        </p>
      ) : (
        <>
        <div className="stats-scroll" role="region" aria-label="Model stats" tabIndex={0}>
          <table className="stats-table" data-testid="stats-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" title={c.title} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() =>
                        setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: firstDirection(c.key) }))
                      }
                    >
                      {c.label}
                      <span aria-hidden="true">{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.model}>
                  <th scope="row" className="model-cell" title={m.model}>
                    {m.model}
                  </th>
                  <td>
                    <span className="index-cell">
                      <span className="index-bar" style={{ width: `${(m.betrayalIndex / top) * 100}%` }} aria-hidden="true" />
                      <span className="index-value">{m.betrayalIndex.toFixed(2)}</span>
                    </span>
                  </td>
                  <td>{m.games}</td>
                  <td>{ratio(m.asTraitor.wins, m.asTraitor.games)}</td>
                  <td>{ratio(m.asFaithful.wins, m.asFaithful.games)}</td>
                  <td>{m.caughtAsTraitor}</td>
                  <td>{m.faithfulsBanishedByTraitorVote}</td>
                  <td>
                    {m.recruitOffersAccepted}/{m.recruitOffersReceived}
                  </td>
                  <td>{pct(m.fallbackRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint scroll-hint">Scroll sideways to see every column.</p>
        </>
      )}
      <p className="hint">Per seat, so a few games make noisy numbers. Column meanings: docs/STATS.md. Hover a heading for its definition.</p>
      <div>{picker}</div>
    </main>
  );
}

