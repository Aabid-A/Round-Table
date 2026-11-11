import type { GameLog } from '../../../src/engine/types.js';
import type { Phase } from '../../../src/types.js';
import type { ServerMessage } from '../../../server/protocol.js';

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;

export interface TurnInfo {
  id: number;
  phase: Phase;
  options: string[];
  user: string;
  timeoutMs: number;
  /** Set when the engine asked again after an answer it could not use. */
  error: string | null;
}

export interface Identity {
  code: string;
  you: string;
  host: boolean;
}

export type RoomView =
  | { kind: 'home' }
  | { kind: 'lobby'; lobby: Msg<'lobby'> | null }
  | { kind: 'playing'; phase: Phase | null; turn: TurnInfo | null; timedOut: boolean }
  | { kind: 'finished'; log: GameLog }
  | { kind: 'closed'; reason: string };

export interface RoomState {
  view: RoomView;
  /** Null until the server has seated this person. */
  me: Identity | null;
  /** False while the connection is down and the page is trying to get back. */
  online: boolean;
  /** The last thing the server refused, shown where the person is looking. */
  error: string | null;
}

export type RoomEvent = { kind: 'message'; msg: ServerMessage } | { kind: 'offline' } | { kind: 'online' } | { kind: 'leave' } | { kind: 'dismissError' };

export const initialState = (): RoomState => ({ view: { kind: 'home' }, me: null, online: true, error: null });

export function roomReducer(state: RoomState, event: RoomEvent): RoomState {
  switch (event.kind) {
    case 'offline':
      return { ...state, online: false };
    case 'online':
      return { ...state, online: true };
    case 'leave':
      return initialState();
    case 'dismissError':
      return { ...state, error: null };
    case 'message':
      return onMessage(state, event.msg);
  }
}

function onMessage(state: RoomState, msg: ServerMessage): RoomState {
  const { view } = state;
  switch (msg.t) {
    case 'joined':
      return { ...state, error: null, me: { code: msg.code, you: msg.you, host: msg.host }, view: view.kind === 'home' ? { kind: 'lobby', lobby: null } : view };
    case 'lobby':
      return view.kind === 'playing' || view.kind === 'finished' || view.kind === 'closed' ? state : { ...state, view: { kind: 'lobby', lobby: msg } };
    case 'status': {
      if (view.kind === 'finished' || view.kind === 'closed') return state;
      const was = view.kind === 'playing' ? view : null;
      // Someone else is acting now, so this person's own turn (if it was open) is over.
      return { ...state, view: { kind: 'playing', phase: msg.phase ?? was?.phase ?? null, turn: null, timedOut: was?.timedOut ?? false } };
    }
    case 'turn': {
      if (view.kind === 'finished' || view.kind === 'closed') return state;
      const turn: TurnInfo = { id: msg.turn, phase: msg.phase, options: msg.options, user: msg.user, timeoutMs: msg.timeoutMs, error: msg.error };
      return { ...state, view: { kind: 'playing', phase: msg.phase, turn, timedOut: false } };
    }
    case 'turn_over':
      return view.kind === 'playing' && view.turn?.id === msg.turn ? { ...state, view: { ...view, turn: null, timedOut: true } } : state;
    case 'finished':
      return { ...state, view: { kind: 'finished', log: msg.log } };
    case 'closed':
      return { ...state, view: { kind: 'closed', reason: msg.reason } };
    case 'error':
      return { ...state, error: msg.message };
  }
}
