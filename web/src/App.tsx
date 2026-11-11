import { useEffect, useState } from 'react';
import type { GameLog } from '../../src/engine/types.js';
import { Loader } from './Loader.js';
import { Player } from './Player.js';
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

  if (state.kind === 'ready') {
    return <Player log={state.log} onReload={() => setState({ kind: 'idle' })} />;
  }
  return (
    <Loader
      status={state.kind === 'error' ? 'error' : state.kind === 'loading' ? 'loading' : 'idle'}
      message={state.kind === 'error' ? state.message : state.kind === 'loading' ? state.what : null}
      onFile={(file) => {
        setState({ kind: 'loading', what: file.name });
        void loadFromFile(file).then(settle);
      }}
    />
  );
}
