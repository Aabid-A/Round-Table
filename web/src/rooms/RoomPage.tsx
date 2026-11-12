import { useEffect, useReducer, useRef } from 'react';
import './rooms.css';
import { RoomConnection, sessionStore } from './connection.js';
import { End } from './End.js';
import { Game } from './Game.js';
import { Guess } from './Guess.js';
import { Home } from './Home.js';
import { Lobby } from './Lobby.js';
import { roomCodeFromSearch, roomSeedFromSearch, roomServerHost, roomServerUrl } from './params.js';
import { initialState, roomReducer } from './state.js';

/** ?mode=room, or an invite link: play a game with friends through a room server. */
export function RoomPage() {
  const [state, dispatch] = useReducer(roomReducer, undefined, initialState);
  const conn = useRef<RoomConnection | null>(null);
  const serverUrl = roomServerUrl(import.meta.env.VITE_ROOM_SERVER as string | undefined, window.location);
  if (conn.current === null) conn.current = new RoomConnection({ url: serverUrl, onEvent: dispatch, store: sessionStore() });
  const connection = conn.current;

  useEffect(() => {
    document.title = 'Round Table: play with friends';
    connection.resume(); // after a reload, take the seat back
    return () => connection.dispose();
  }, [connection]);

  if (state.view.kind === 'home') {
    return (
      <Home
        serverHost={roomServerHost(serverUrl)}
        inviteCode={roomCodeFromSearch(window.location.search)}
        serverError={state.error}
        offline={!state.online}
        onDismissError={() => dispatch({ kind: 'dismissError' })}
        onCreate={(m) => {
          const seed = roomSeedFromSearch(window.location.search);
          connection.send(seed === undefined ? m : { ...m, seed });
        }}
        onJoin={(m) => connection.send(m)}
      />
    );
  }
  if (state.view.kind === 'lobby' && state.me) {
    return <Lobby me={state.me} lobby={state.view.lobby} serverError={state.error} onStart={() => connection.send({ t: 'start' })} onLeave={() => connection.leave()} />;
  }
  if (state.view.kind === 'playing' && state.me) {
    return (
      <Game
        me={state.me}
        phase={state.view.phase}
        turn={state.view.turn}
        timedOut={state.view.timedOut}
        offline={!state.online}
        onAnswer={(turn, answer) => (dispatch({ kind: 'answered' }), connection.send({ t: 'answer', turn, answer }))}
        onLeave={() => connection.leave()}
      />
    );
  }
  if (state.view.kind === 'guessing') {
    return (
      <Guess
        seats={state.view.seats}
        you={state.view.you}
        timeoutMs={state.view.timeoutMs}
        sent={state.view.sent}
        onSubmit={(ai) => (dispatch({ kind: 'guessed' }), connection.send({ t: 'guess', ai }))}
      />
    );
  }
  if (state.view.kind === 'finished' && state.me) return <End me={state.me} log={state.view.log} outcome={state.view.outcome} onLeave={() => connection.leave()} />;
  if (state.view.kind === 'closed') {
    return (
      <main className="loader rooms" data-testid="room-closed">
        <h1>This room has closed</h1>
        <p className="notice" role="status">
          {state.view.reason}
        </p>
        <p>
          <button type="button" className="btn btn-primary" onClick={() => connection.leave()}>
            Back to the start
          </button>
        </p>
      </main>
    );
  }
  return null;
}
