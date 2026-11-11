import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '../../server/protocol.js';
import { initialState, roomReducer, type RoomEvent, type RoomState } from '../../web/src/rooms/state.js';
import { logFrom } from '../helpers/logs.js';

const run = (events: RoomEvent[], from: RoomState = initialState()): RoomState => events.reduce(roomReducer, from);
const msg = (m: ServerMessage): RoomEvent => ({ kind: 'message', msg: m });
const joined = msg({ t: 'joined', code: 'AB2CD', token: 't', you: 'Quinn', host: true });
const lobby: ServerMessage = { t: 'lobby', code: 'AB2CD', mode: 'mock', seats: [{ name: 'Quinn', connected: true, host: true }], aiSeats: 7, maxHumans: 8 };
const turn = (id: number): ServerMessage => ({ t: 'turn', turn: id, phase: 'vote', options: ['Aria'], user: 'ctx\n\nTask', timeoutMs: 1000, error: null });

describe('roomReducer', () => {
  it('starts at home, then shows the lobby once seated', () => {
    expect(initialState().view).toEqual({ kind: 'home' });
    const s = run([joined]);
    expect(s.me).toEqual({ code: 'AB2CD', you: 'Quinn', host: true });
    expect(s.view).toEqual({ kind: 'lobby', lobby: null });
    expect(run([msg(lobby)], s).view).toEqual({ kind: 'lobby', lobby });
  });

  it('moves from lobby to playing to finished, with this person\'s turn open only while it is theirs', () => {
    let s = run([joined, msg(lobby), msg({ t: 'status', phase: 'night' })]);
    expect(s.view).toEqual({ kind: 'playing', phase: 'night', turn: null, timedOut: false });
    s = run([msg(turn(1))], s);
    expect(s.view).toMatchObject({ kind: 'playing', phase: 'vote', turn: { id: 1, options: ['Aria'] } });
    s = run([msg({ t: 'status', phase: 'whispers' })], s);
    expect(s.view).toEqual({ kind: 'playing', phase: 'whispers', turn: null, timedOut: false });
    const log = logFrom({ Quinn: 'faithful', Aria: 'traitor' }, []);
    s = run([msg({ t: 'finished', log, you: 'Quinn' })], s);
    expect(s.view).toEqual({ kind: 'finished', log });
  });

  it('closes the turn and says so when time runs out, but only for the turn that expired', () => {
    let s = run([joined, msg(turn(2))]);
    expect(run([msg({ t: 'turn_over', turn: 1 })], s).view).toMatchObject({ turn: { id: 2 } });
    s = run([msg({ t: 'turn_over', turn: 2 })], s);
    expect(s.view).toEqual({ kind: 'playing', phase: 'vote', turn: null, timedOut: true });
    expect(run([msg(turn(3))], s).view).toMatchObject({ timedOut: false, turn: { id: 3 } });
  });

  it('keeps the screen across a reconnect: offline, then the server seats the person again', () => {
    let s = run([joined, msg({ t: 'status', phase: 'vote' }), msg(turn(1))]);
    s = run([{ kind: 'offline' }], s);
    expect(s.online).toBe(false);
    s = run([{ kind: 'online' }, joined, msg({ t: 'status', phase: null }), msg(turn(1))], s);
    expect(s.online).toBe(true);
    expect(s.view).toMatchObject({ kind: 'playing', phase: 'vote', turn: { id: 1 } });
  });

  it('keeps a finished or closed screen when late messages arrive', () => {
    const done = run([joined, msg({ t: 'closed', reason: 'expired' })]);
    expect(run([msg(lobby), msg({ t: 'status', phase: 'night' }), msg(turn(1))], done).view).toEqual({ kind: 'closed', reason: 'expired' });
  });

  it('shows an error until it is dismissed, and a new seat clears it', () => {
    let s = run([msg({ t: 'error', message: 'No room has that code.' })]);
    expect(s.error).toBe('No room has that code.');
    expect(run([{ kind: 'dismissError' }], s).error).toBeNull();
    s = run([joined], s);
    expect(s.error).toBeNull();
  });

  it('goes back to the start when the person leaves', () => {
    expect(run([joined, { kind: 'leave' }])).toEqual(initialState());
  });
});
