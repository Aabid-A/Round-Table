import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '../../server/protocol.js';
import { initialState, roomReducer, type RoomEvent, type RoomState } from '../../web/src/rooms/state.js';
import { logFrom } from '../helpers/logs.js';

const outcome = { people: [], scores: null, fooling: null, trust: null };

const run = (events: RoomEvent[], from: RoomState = initialState()): RoomState => events.reduce(roomReducer, from);
const msg = (m: ServerMessage): RoomEvent => ({ kind: 'message', msg: m });
const joined = msg({ t: 'joined', code: 'AB2CD', token: 't', you: 'Quinn', host: true });
const lobby: ServerMessage = { t: 'lobby', code: 'AB2CD', mode: 'mock', aliases: false, seats: [{ name: 'Quinn', connected: true, host: true }], aiSeats: 7, maxHumans: 8 };
const turn = (id: number): ServerMessage => ({ t: 'turn', turn: id, phase: 'vote', options: ['Aria'], user: 'ctx\n\nTask', timeoutMs: 1000, error: null });

describe('roomReducer', () => {
  it('starts at home, then shows the lobby once seated', () => {
    expect(initialState().view).toEqual({ kind: 'home' });
    const s = run([joined]);
    expect(s.me).toEqual({ code: 'AB2CD', you: 'Quinn', host: true, alias: null, watch: null });
    expect(s.view).toEqual({ kind: 'lobby', lobby: null });
    expect(run([msg(lobby)], s).view).toEqual({ kind: 'lobby', lobby });
  });

  it('moves from lobby to playing to finished, with this person\'s turn open only while it is theirs', () => {
    let s = run([joined, msg(lobby), msg({ t: 'status', phase: 'night' })]);
    expect(s.view).toEqual({ kind: 'playing', phase: 'night', turn: null, timedOut: false, ghost: null });
    s = run([msg(turn(1))], s);
    expect(s.view).toMatchObject({ kind: 'playing', phase: 'vote', turn: { id: 1, options: ['Aria'] } });
    s = run([msg({ t: 'status', phase: 'whispers' })], s);
    expect(s.view).toEqual({ kind: 'playing', phase: 'whispers', turn: null, timedOut: false, ghost: null });
    const log = logFrom({ Quinn: 'faithful', Aria: 'traitor' }, []);
    s = run([msg({ t: 'finished', log, you: 'Quinn', outcome })], s);
    expect(s.view).toEqual({ kind: 'finished', log, outcome });
  });

  it('closes the turn and says so when time runs out, but only for the turn that expired', () => {
    let s = run([joined, msg(turn(2))]);
    expect(run([msg({ t: 'turn_over', turn: 1 })], s).view).toMatchObject({ turn: { id: 2 } });
    s = run([msg({ t: 'turn_over', turn: 2 })], s);
    expect(s.view).toEqual({ kind: 'playing', phase: 'vote', turn: null, timedOut: true, ghost: null });
    // The next turn often arrives at once, so the note stays until the person answers one.
    s = run([msg(turn(3))], s);
    expect(s.view).toMatchObject({ timedOut: true, turn: { id: 3 } });
    expect(run([{ kind: 'answered' }], s).view).toMatchObject({ timedOut: false, turn: { id: 3 } });
    expect(run([{ kind: 'answered' }], initialState()).view).toEqual({ kind: 'home' });
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

  it('keeps the result on screen when the room closes after the game ended', () => {
    const log = logFrom({ Quinn: 'faithful', Aria: 'traitor' }, []);
    const s = run([joined, msg({ t: 'finished', log, you: 'Quinn', outcome }), msg({ t: 'closed', reason: 'This room expired.' })]);
    expect(s.view).toEqual({ kind: 'finished', log, outcome });
  });

  it('learns the alias, then guesses, then sees the outcome', () => {
    let s = run([joined, msg(lobby), msg({ t: 'alias', alias: 'Cleo' }), msg({ t: 'status', phase: 'night' })]);
    expect(s.me).toEqual({ code: 'AB2CD', you: 'Quinn', host: true, alias: 'Cleo', watch: null });
    s = run([msg({ t: 'guess', seats: ['Aria', 'Bram', 'Cleo'], you: 'Cleo', timeoutMs: 1000, sent: false })], s);
    expect(s.view).toEqual({ kind: 'guessing', seats: ['Aria', 'Bram', 'Cleo'], you: 'Cleo', timeoutMs: 1000, sent: false });
    // Nothing from the game can pull a person out of the guessing screen.
    expect(run([msg({ t: 'status', phase: 'vote' }), msg(turn(1)), msg(lobby)], s).view).toMatchObject({ kind: 'guessing' });
    s = run([{ kind: 'guessed' }], s);
    expect(s.view).toMatchObject({ kind: 'guessing', sent: true });
    const log = logFrom({ Quinn: 'faithful', Aria: 'traitor' }, []);
    expect(run([msg({ t: 'finished', log, you: 'Quinn', outcome })], s).view).toEqual({ kind: 'finished', log, outcome });
  });

  it('keeps the alias across a reconnect to the same room, and forgets it for another room', () => {
    let s = run([joined, msg({ t: 'alias', alias: 'Cleo' }), { kind: 'offline' }, { kind: 'online' }, joined]);
    expect(s.me?.alias).toBe('Cleo');
    s = run([msg({ t: 'joined', code: 'ZZ2ZZ', token: 't', you: 'Quinn', host: true })], s);
    expect(s.me?.alias).toBeNull();
  });

  it('ignores a guess click that is not on the guessing screen', () => {
    expect(run([joined, { kind: 'guessed' }]).view).toEqual({ kind: 'lobby', lobby: null });
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

describe('roomReducer: ghosts and the watch link', () => {
  const ghost = (you = 'Quinn'): ServerMessage => ({ t: 'ghost', you, seats: [{ name: 'Aria', status: 'alive', prompt: 'You are Aria. Your role: faithful.' }] });

  it('keeps the host’s watch token, and a friend has none', () => {
    const host = run([msg({ t: 'joined', code: 'AB2CD', token: 't', you: 'Quinn', host: true, watch: '3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f' })]);
    expect(host.me?.watch).toBe('3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f');
    expect(run([joined]).me?.watch).toBeNull();
  });

  it('shows a ghost the views once they arrive, and keeps them through the phases that follow', () => {
    let s = run([joined, msg(lobby), msg({ t: 'status', phase: 'night' })]);
    expect(s.view).toMatchObject({ kind: 'playing', ghost: null });
    s = run([msg(ghost())], s);
    expect(s.view).toMatchObject({ kind: 'playing', ghost: { t: 'ghost', you: 'Quinn' } });
    s = run([msg({ t: 'status', phase: 'whispers' }), msg({ t: 'status', phase: 'round_table' })], s);
    expect(s.view).toMatchObject({ kind: 'playing', phase: 'round_table', ghost: { you: 'Quinn' } });
    // A newer snapshot replaces the old.
    s = run([msg({ t: 'ghost', you: 'Quinn', seats: [] })], s);
    expect(s.view).toMatchObject({ ghost: { seats: [] } });
  });

  it('shows a person who rejoins a game in progress their ghost view straight away, and ignores one after the game', () => {
    expect(run([joined, msg(ghost())]).view).toMatchObject({ kind: 'playing', ghost: { you: 'Quinn' } });
    const log = logFrom({ Quinn: 'faithful', Aria: 'traitor' }, []);
    const done = run([joined, msg({ t: 'finished', log, you: 'Quinn', outcome }), msg(ghost())]);
    expect(done.view.kind).toBe('finished');
  });
});
