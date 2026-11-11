import { useEffect, useState } from 'react';
import type { GameLog } from '../../src/engine/types.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { Loader } from './Loader.js';
import { Player } from './Player.js';
import { isRecordMode, parseRecordParams } from './record/params.js';
import { RecordView } from './record/RecordView.js';
import { loadFromFile, loadFromName, logNameFromSearch, type LoadResult } from './load.js';

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; what: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; log: GameLog };

export function App() {
  const [state, setState] = useState<State>(() =>
    logNameFromSearch(window.location.search) ? { kind: 'loading', what: 'the log' } : { kind: 'idle' },
  );

  const settle = (r: LoadResult): void => setState(r.ok ? { kind: 'ready', log: r.log } : { kind: 'error', message: r.message });

  useEffect(() => {
    const name = logNameFromSearch(window.location.search);
    if (!name) return;
    setState({ kind: 'loading', what: name });
    void loadFromName(name, import.meta.env.BASE_URL).then(settle);
  }, []);

  if (isRecordMode(window.location.search)) {
    return <RecordPage state={state} />;
  }

  const loader = (status: 'idle' | 'loading' | 'error', message: string | null) => (
    <Loader
      status={status}
      message={message}
      onFile={(file) => {
        setState({ kind: 'loading', what: file.name });
        void loadFromFile(file).then(settle);
      }}
    />
  );

  if (state.kind === 'ready') {
    return (
      <ErrorBoundary key={state.log.seed} fallback={(message) => loader('error', message)}>
        <Player log={state.log} onReload={() => setState({ kind: 'idle' })} />
      </ErrorBoundary>
    );
  }
  return loader(
    state.kind === 'error' ? 'error' : state.kind === 'loading' ? 'loading' : 'idle',
    state.kind === 'error' ? state.message : state.kind === 'loading' ? state.what : null,
  );
}

/** ?mode=record: no file picker, no chrome. Needs ?log=<name>. Problems are shown as plain text. */
function RecordPage({ state }: { state: State }) {
  const parsed = parseRecordParams(window.location.search);
  if (!parsed.ok) return <p className="rec-error" role="alert">{parsed.message}</p>;
  if (state.kind === 'ready') return <RecordView log={state.log} params={parsed.params} />;
  if (state.kind === 'error') return <p className="rec-error" role="alert">{state.message}</p>;
  if (state.kind === 'loading') return <p className="rec-error" role="status">Loading {state.what}…</p>;
  return <p className="rec-error" role="alert">Recording mode needs ?log=&lt;name&gt; for a file in web/public/games/.</p>;
}
