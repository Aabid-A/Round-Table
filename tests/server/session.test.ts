import { describe, expect, it } from 'vitest';
import { Registry } from '../../server/registry.js';
import { Session, type Runtime } from '../../server/session.js';
import { FakeConn } from './helpers.js';

function server() {
  const registry = new Registry();
  const runtimes = new Map<string, Runtime>();
  const logged: string[] = [];
  const open = () => {
    const conn = new FakeConn();
    const session = new Session(conn, { registry, runtimes, options: { turnMs: 1000, log: (l) => logged.push(l) } });
    const send = (m: unknown) => session.handle(JSON.stringify(m));
    return { conn, session, send };
  };
  return { registry, runtimes, logged, open };
}
const joinedOf = (c: FakeConn) => c.sent.find((m) => m.t === 'joined') as Extract<(typeof c.sent)[number], { t: 'joined' }>;

describe('Session: creating, joining and rejoining', () => {
  it('creates a room, seats the host, and shows the lobby', () => {
    const s = server();
    const host = s.open();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const joined = joinedOf(host.conn);
    expect(joined).toMatchObject({ t: 'joined', you: 'Quinn', host: true });
    expect(joined.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(host.conn.sent.at(-1)).toMatchObject({ t: 'lobby', code: joined.code, mode: 'mock', aiSeats: 7, seats: [{ name: 'Quinn', connected: true, host: true }] });
  });

  it('lets friends join by code in any case and tells everyone', () => {
    const s = server();
    const host = s.open();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const code = joinedOf(host.conn).code;
    const friend = s.open();
    friend.send({ t: 'join', code: code.toLowerCase(), name: 'Rae' });
    expect(joinedOf(friend.conn)).toMatchObject({ you: 'Rae', host: false });
    for (const c of [host.conn, friend.conn]) expect(c.sent.at(-1)).toMatchObject({ t: 'lobby', aiSeats: 6, seats: [{ name: 'Quinn' }, { name: 'Rae' }] });
  });

  it('says what went wrong: unknown code, taken name, a second seat, bad input', () => {
    const s = server();
    const host = s.open();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const code = joinedOf(host.conn).code;
    const other = s.open();
    other.send({ t: 'join', code: 'ZZZZZ', name: 'Rae' });
    other.send({ t: 'join', code, name: 'quinn' });
    other.send({ t: 'join', code, name: 'Rae' });
    other.send({ t: 'join', code, name: 'Sam' });
    host.send({ t: 'create', name: 'Quinn2', mode: 'mock' });
    other.session.handle('not json');
    const errors = [...other.conn.sent, ...host.conn.sent].filter((m) => m.t === 'error').map((m) => (m as { message: string }).message);
    expect(errors).toEqual(['No room has that code. Check it and try again.', 'quinn is taken at this table. Choose another name.', 'You already have a seat.', 'Messages must be JSON.', 'You already have a seat.']);
  });

  it('keeps a seat when the connection drops, and returns it by token', () => {
    const s = server();
    const host = s.open();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const { code, token } = joinedOf(host.conn);
    host.session.disconnect();
    const back = s.open();
    back.send({ t: 'rejoin', code, token });
    expect(joinedOf(back.conn)).toMatchObject({ you: 'Quinn', host: true, token });
    expect(back.conn.sent.at(-1)).toMatchObject({ t: 'lobby', seats: [{ name: 'Quinn', connected: true }] });
    const stranger = s.open();
    stranger.send({ t: 'rejoin', code, token: '00000000-0000-0000-0000-000000000000' });
    stranger.send({ t: 'rejoin', code: 'ZZZZZ', token });
    expect(stranger.conn.sent.map((m) => (m as { message?: string }).message)).toEqual(['That seat is not at this table.', 'That room has closed.']);
  });

  it('forgets a room when it closes', () => {
    const s = server();
    const host = s.open();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const code = joinedOf(host.conn).code;
    expect(s.runtimes.has(code)).toBe(true);
    s.registry.get(code)!.close('done');
    expect(s.runtimes.has(code)).toBe(false);
    expect(s.runtimes.size).toBe(0);
  });
});
