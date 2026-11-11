import { useEffect, useReducer, useRef } from 'react';
import './rooms.css';
import { RoomConnection, sessionStore } from './connection.js';
import { Home } from './Home.js';
import { Lobby } from './Lobby.js';
import { roomCodeFromSearch, roomServerUrl } from './params.js';
import { initialState, roomReducer } from './state.js';

/** ?mode=room, or an invite link: play a game with friends through a room server. */
export function RoomPage() {
  const [state, dispatch] = useReducer(roomReducer, undefined, initialState);
  const conn = useRef<RoomConnection | null>(null);
  if (conn.current === null) {
    const url = roomServerUrl(import.meta.env.VITE_ROOM_SERVER as string | undefined, window.location);
    conn.current = new RoomConnection({ url, onEvent: dispatch, store: sessionStore() });
  }
  const connection = conn.current;

  useEffect(() => {
    document.title = 'Round Table: play with friends';
    connection.resume(); // after a reload, take the seat back
    return () => connection.dispose();
  }, [connection]);

  if (state.view.kind === 'home') {
    return (
      <Home
        inviteCode={roomCodeFromSearch(window.location.search)}
        serverError={state.error}
        offline={!state.online}
        onDismissError={() => dispatch({ kind: 'dismissError' })}
        onCreate={(m) => connection.send(m)}
        onJoin={(m) => connection.send(m)}
      />
    );
  }
  if (state.view.kind === 'lobby' && state.me) {
    return <Lobby me={state.me} lobby={state.view.lobby} serverError={state.error} onStart={() => connection.send({ t: 'start' })} onLeave={() => connection.leave()} />;
  }
  return (
    <main className="loader rooms">
      <p className="notice" role="status">
        Connected to room {state.me?.code}.
      </p>
    </main>
  );
}
