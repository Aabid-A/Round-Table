import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../../server/protocol.js';
import { Registry } from '../../server/registry.js';
import { Session, type Runtime } from '../../server/session.js';
import { formFor, emptyAnswer } from '../../web/src/play/human.js';
import { FakeConn, waitFor } from './helpers.js';

function server(turnMs = 1000, allowSeed = true) {
  const registry = new Registry();
  const runtimes = new Map<string, Runtime>();
  const logged: string[] = [];
  const open = () => {
    const conn = new FakeConn();
    const session = new Session(conn, { registry, runtimes, options: { turnMs, abandonMs: 5000, allowSeed, log: (l) => logged.push(l) } });
    const send = (m: unknown) => session.handle(JSON.stringify(m));
    /** Answer every turn at once, as a patient person would. */
    const autoplay = () => {
      const original = conn.send.bind(conn);
      conn.send = (m) => {
        original(m);
        if (m.t !== 'turn') return;
        const spec = formFor(m.phase, m.options);
        send({ t: 'answer', turn: m.turn, answer: { ...emptyAnswer(), speech: spec.speechLabel ? 'hello' : '', message: spec.messageLabel ? 'because' : '', choice: spec.choices[0]!.value } });
      };
    };
    return { conn, session, send, autoplay };
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

  it('shows the others when someone in the lobby goes offline', () => {
    const s = server();
    const host = s.open();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock' });
    const friend = s.open();
    friend.send({ t: 'join', code: joinedOf(host.conn).code, name: 'Rae' });
    friend.session.disconnect();
    expect(host.conn.sent.at(-1)).toMatchObject({ t: 'lobby', seats: [{ name: 'Quinn', connected: true }, { name: 'Rae', connected: false }] });
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

  it('refuses a flood of messages, says so once, and works again later', () => {
    let now = 0;
    const registry = new Registry();
    const conn = new FakeConn();
    const session = new Session(conn, { registry, runtimes: new Map(), options: { turnMs: 1000, abandonMs: 5000, now: () => now, log: () => undefined } });
    for (let i = 0; i < LIMITS.messagesPerWindow + 20; i++) session.handle('not json');
    const errors = conn.sent.map((m) => (m as { message: string }).message);
    expect(errors.filter((m) => m === 'Messages must be JSON.')).toHaveLength(LIMITS.messagesPerWindow);
    expect(errors.filter((m) => m.startsWith('You are sending messages too fast'))).toHaveLength(1);
    now = LIMITS.windowMs;
    session.handle(JSON.stringify({ t: 'create', name: 'Quinn', mode: 'mock' }));
    expect(conn.sent.some((m) => m.t === 'joined')).toBe(true);
  });

  it('ignores a seed sent by the page unless the server allows it, since the seed decides every role', () => {
    const rooms = (allow: boolean) => {
      const s = server(1000, allow);
      const host = s.open();
      host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 123 });
      return s.registry.get(joinedOf(host.conn).code)!.seed;
    };
    expect(rooms(true)).toBe(123);
    const picked = [rooms(false), rooms(false), rooms(false)];
    expect(picked).not.toContain(123);
    expect(new Set(picked).size).toBeGreaterThan(1); // the server chose its own, differently each time
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

  it('runs the game when the host starts it, and sends the finished log to everyone', async () => {
    const s = server();
    const host = s.open();
    host.autoplay();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 4 });
    const code = joinedOf(host.conn).code;
    const friend = s.open();
    friend.autoplay();
    friend.send({ t: 'join', code, name: 'Rae' });
    friend.send({ t: 'start' });
    host.send({ t: 'start' });
    await waitFor(() => host.conn.sent.some((m) => m.t === 'finished') && friend.conn.sent.some((m) => m.t === 'finished'));
    const finished = friend.conn.sent.find((m) => m.t === 'finished') as { log: { cast: unknown[]; result: { winner: string } }; you: string };
    expect(finished.you).toBe('Rae');
    expect(finished.log.cast).toHaveLength(8);
    expect(s.registry.get(code)!.phase).toBe('finished');
    expect(s.registry.get(code)!.finishedAt).not.toBeNull();
    const messages = (c: FakeConn) => c.sent.map((m) => (m as { message?: string }).message).filter(Boolean);
    expect(messages(friend.conn)).toEqual(['Only the host can start the game.']);
    host.send({ t: 'start' });
    host.send({ t: 'answer', turn: 1, answer: { speech: '', note: '', choice: null, message: '' } });
    expect(messages(host.conn)).toEqual(['The game has already started.', 'The game is not running.']);
    const late = s.open();
    late.send({ t: 'join', code, name: 'Sam' });
    expect(messages(late.conn)).toEqual(['That game has already started.']);
  });

  it('gives the finished log back to someone who rejoins after the end', async () => {
    const s = server();
    const host = s.open();
    host.autoplay();
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 4 });
    const { code, token } = joinedOf(host.conn);
    host.send({ t: 'start' });
    await waitFor(() => host.conn.sent.some((m) => m.t === 'finished'));
    host.session.disconnect();
    const back = s.open();
    back.send({ t: 'rejoin', code, token });
    expect(back.conn.sent.map((m) => m.t)).toEqual(['joined', 'finished']);
  });

  describe('a game nobody is watching', () => {
    afterEach(() => vi.useRealTimers());

    const startedRoom = () => {
      vi.useFakeTimers();
      const s = server(1_000_000); // longer than the test, so only the abandon timer matters
      const host = s.open();
      host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 4 });
      const { code, token } = joinedOf(host.conn);
      host.send({ t: 'start' }); // Quinn's first turn waits for an answer that never comes
      return { s, host, code, token };
    };

    it('closes the room and stops the game after the grace period', async () => {
      const { s, host, code } = startedRoom();
      const room = s.registry.get(code)!;
      host.session.disconnect();
      await vi.advanceTimersByTimeAsync(4999);
      expect(room.phase).toBe('playing');
      await vi.advanceTimersByTimeAsync(1);
      expect(room.phase).toBe('closed');
      expect(s.registry.get(code)).toBeUndefined(); // a closed room is forgotten
      expect(s.runtimes.has(code)).toBe(false);
    });

    it('keeps the game when someone comes back in time', async () => {
      const { s, host, code, token } = startedRoom();
      host.session.disconnect();
      await vi.advanceTimersByTimeAsync(4000);
      const back = s.open();
      back.send({ t: 'rejoin', code, token });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(s.registry.get(code)!.phase).toBe('playing');
      expect(back.conn.sent.map((m) => m.t)).toEqual(['joined', 'status', 'turn']);
      // Told the phase the table is in now, not "starting", though no phase change happened since they left.
      const status = back.conn.sent[1] as { phase: string | null };
      expect(status.phase).not.toBeNull();
      expect(status.phase).toBe(s.registry.get(code)!.status);
    });
  });
});
