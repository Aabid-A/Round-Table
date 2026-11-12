import { useEffect, useMemo, useRef, useState } from 'react';
import './rooms.css';
import type { ServerMessage, SpectatorLog } from '../../../server/protocol.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import { Player } from '../Player.js';
import { roomServerUrl, watchFromSearch } from './params.js';
import { asLog, hasSomethingToShow } from './watch.js';

type State =
  | { kind: 'connecting' }
  | { kind: 'lobby' }
  | { kind: 'watching'; log: SpectatorLog; complete: boolean }
  | { kind: 'closed'; reason: string }
  | { kind: 'refused'; message: string };

/** ?mode=watch&room=CODE&k=TOKEN: the game one full round behind, read-only, in the all-seeing room. Nothing is sent but the link's token. */
export function WatchPage() {
  const link = useMemo(() => watchFromSearch(window.location.search), []);
  const [state, setState] = useState<State>(link ? { kind: 'connecting' } : { kind: 'refused', message: 'That watch link does not look right.' });
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    document.title = 'Round Table: watching';
    if (!link) return;
    let stop = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const url = roomServerUrl(import.meta.env.VITE_ROOM_SERVER as string | undefined, window.location);
    const open = (): void => {
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => {
        attempts = 0;
        ws.send(JSON.stringify({ t: 'watch', code: link.code, token: link.token }));
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data)) as ServerMessage;
        if (m.t === 'spectate') setState(m.log === null ? { kind: 'lobby' } : { kind: 'watching', log: m.log, complete: m.complete });
        else if (m.t === 'closed') (stop = true), setState({ kind: 'closed', reason: m.reason });
        else if (m.t === 'error') (stop = true), setState({ kind: 'refused', message: m.message });
      };
      ws.onclose = () => {
        if (stop) return;
        timer = setTimeout(open, Math.min(10_000, 500 * 2 ** attempts++)); // the server sends the game as it stands when we are back
      };
    };
    open();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      socket.current?.close();
    };
  }, [link]);

  const log = useMemo(() => (state.kind === 'watching' ? asLog(state.log) : null), [state]);
  if (state.kind === 'watching' && log && hasSomethingToShow(state.log)) {
    return (
      <>
        <p className="notice watch-note" data-testid="watch-note" role="status">
          {state.complete ? 'The game is over. This is all of it.' : 'Watching read-only, one full round behind the game. More arrives as each round ends.'}
        </p>
        <ErrorBoundary key={log.seed} fallback={(message) => <p className="notice notice-error">{message}</p>}>
          <Player log={log} live={!state.complete} initial={{ kind: 'spectator' }} />
        </ErrorBoundary>
      </>
    );
  }
  return (
    <main className="loader rooms" data-testid="watch">
      <h1>Watching a room</h1>
      {state.kind === 'connecting' && (
        <p className="notice" role="status">
          Connecting…
        </p>
      )}
      {state.kind === 'watching' && (
        <p className="notice" role="status" data-testid="watch-first-round">
          The first round is under way. This page shows it, and then each round after it, once that round is over.
        </p>
      )}
      {state.kind === 'lobby' && (
        <p className="notice" role="status" data-testid="watch-lobby">
          The game has not started yet. This page shows it, one full round behind, once it does.
        </p>
      )}
      {state.kind === 'closed' && (
        <p className="notice" role="status" data-testid="watch-closed">
          {state.reason}
        </p>
      )}
      {state.kind === 'refused' && (
        <p className="notice notice-error" role="alert" data-testid="watch-refused">
          {state.message}
        </p>
      )}
    </main>
  );
}
