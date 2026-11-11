import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomConnection, sessionStore, type Saved, type SocketLike, type Store } from '../../web/src/rooms/connection.js';
import type { RoomEvent } from '../../web/src/rooms/state.js';

class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  receive(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
  drop() {
    this.onclose?.();
  }
}

describe('RoomConnection', () => {
  let sockets: FakeSocket[];
  let events: RoomEvent[];
  let saved: Saved | null;
  let conn: RoomConnection;
  const store: Store = { load: () => saved, save: (s) => void (saved = s), clear: () => void (saved = null) };
  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    events = [];
    saved = null;
    conn = new RoomConnection({ url: 'ws://x', onEvent: (e) => events.push(e), store, createSocket: () => (sockets.push(new FakeSocket()), sockets.at(-1)!), backoff: (n) => 100 * n });
  });
  afterEach(() => vi.useRealTimers());

  it('holds messages until the socket opens, then sends them in order', () => {
    conn.send({ t: 'join', code: 'AB2CD', name: 'Rae' });
    conn.send({ t: 'start' });
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.sent).toEqual([]);
    sockets[0]!.open();
    expect(sockets[0]!.sent.map((s) => JSON.parse(s).t)).toEqual(['join', 'start']);
    conn.send({ t: 'start' });
    expect(sockets[0]!.sent).toHaveLength(3);
  });

  it('saves the seat when the server seats the person, and never the OpenRouter key', () => {
    conn.send({ t: 'create', name: 'Quinn', mode: 'openrouter', key: 'sk-secret', models: ['a/b'], maxCostUsd: 1 });
    sockets[0]!.open();
    sockets[0]!.receive({ t: 'joined', code: 'AB2CD', token: 'tok', you: 'Quinn', host: true });
    expect(saved).toEqual({ code: 'AB2CD', token: 'tok' });
    expect(JSON.stringify(saved)).not.toContain('sk-secret');
    expect(events.at(-1)).toMatchObject({ kind: 'message', msg: { t: 'joined' } });
  });

  it('reconnects with backoff after a drop and takes the saved seat back', () => {
    saved = { code: 'AB2CD', token: 'tok' };
    conn.send({ t: 'start' });
    sockets[0]!.open();
    sockets[0]!.drop();
    expect(events.at(-1)).toEqual({ kind: 'offline' });
    vi.advanceTimersByTime(99);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1]!.drop(); // the second try fails too: a longer wait
    vi.advanceTimersByTime(199);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2]!.open();
    expect(JSON.parse(sockets[2]!.sent[0]!)).toEqual({ t: 'rejoin', code: 'AB2CD', token: 'tok' });
    expect(events.at(-1)).toEqual({ kind: 'online' });
  });

  it('does not retry when there is no saved seat, and stops when the seat is gone', () => {
    conn.send({ t: 'start' });
    sockets[0]!.open();
    sockets[0]!.drop();
    vi.advanceTimersByTime(5000);
    expect(sockets).toHaveLength(1);

    saved = { code: 'AB2CD', token: 'tok' };
    conn.send({ t: 'start' });
    sockets[1]!.open();
    sockets[1]!.receive({ t: 'error', message: 'That seat is not at this table.' });
    expect(saved).toBeNull();
    sockets[1]!.drop();
    vi.advanceTimersByTime(5000);
    expect(sockets).toHaveLength(2);
  });

  it('stops for good when the room closes', () => {
    saved = { code: 'AB2CD', token: 'tok' };
    conn.send({ t: 'start' });
    sockets[0]!.open();
    sockets[0]!.receive({ t: 'closed', reason: 'This room expired.' });
    sockets[0]!.drop();
    vi.advanceTimersByTime(5000);
    expect(sockets).toHaveLength(1);
    expect(saved).toBeNull();
  });

  it('resumes a saved seat, and reports that there is none', () => {
    expect(conn.resume()).toBe(false);
    saved = { code: 'AB2CD', token: 'tok' };
    expect(conn.resume()).toBe(true);
    sockets[0]!.open();
    expect(JSON.parse(sockets[0]!.sent[0]!)).toEqual({ t: 'rejoin', code: 'AB2CD', token: 'tok' });
  });

  it('forgets the seat and closes when the person leaves, without reconnecting', () => {
    saved = { code: 'AB2CD', token: 'tok' };
    conn.send({ t: 'start' });
    sockets[0]!.open();
    conn.leave();
    expect(sockets[0]!.closed).toBe(true);
    expect(saved).toBeNull();
    expect(events.at(-1)).toEqual({ kind: 'leave' });
    vi.advanceTimersByTime(5000);
    expect(sockets).toHaveLength(1);
  });
});

describe('sessionStore', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the seat in this tab and forgets it on clear', () => {
    vi.stubGlobal('sessionStorage', memory());
    const s = sessionStore();
    expect(s.load()).toBeNull();
    s.save({ code: 'AB2CD', token: 'tok' });
    expect(s.load()).toEqual({ code: 'AB2CD', token: 'tok' });
    s.clear();
    expect(s.load()).toBeNull();
  });

  it('ignores a damaged entry, and works without storage at all', () => {
    const bad = memory();
    bad.setItem('round-table-room', '{"code":5}');
    vi.stubGlobal('sessionStorage', bad);
    expect(sessionStore().load()).toBeNull();
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    vi.stubGlobal('sessionStorage', blocked);
    const s = sessionStore();
    expect(s.load()).toBeNull();
    expect(() => (s.save({ code: 'AB2CD', token: 'tok' }), s.clear())).not.toThrow();
  });
});
