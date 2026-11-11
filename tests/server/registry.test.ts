import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../server/protocol.js';
import { Registry } from '../../server/registry.js';
import { FakeConn } from './helpers.js';

const mock = { mode: 'mock' } as const;

describe('Registry', () => {
  it('makes rooms with distinct, well-formed codes', () => {
    const registry = new Registry();
    const codes = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = registry.create(mock);
      if (!r.ok) throw new Error(r.error);
      expect(r.value.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
      codes.add(r.value.code);
      expect(registry.get(r.value.code)).toBe(r.value);
    }
    expect(codes.size).toBe(30);
  });

  it('retries a code that is taken, and gives up after twenty tries', () => {
    const codes = ['AAAAA', 'AAAAA', 'BBBBB'];
    const registry = new Registry({ makeCode: () => codes.shift() ?? 'BBBBB' });
    expect(registry.create(mock).ok).toBe(true);
    const second = registry.create(mock);
    expect(second.ok && second.value.code).toBe('BBBBB');
    expect(registry.create(mock)).toEqual({ ok: false, error: 'Could not make a room code. Try again.' });
  });

  it('stops at the room limit', () => {
    let n = 0;
    const registry = new Registry({ makeCode: () => `R${String(n++).padStart(4, '2')}` });
    for (let i = 0; i < LIMITS.rooms; i++) expect(registry.create(mock).ok).toBe(true);
    expect(registry.create(mock)).toEqual({ ok: false, error: 'This server is full. Try again in a while.' });
  });

  it('closes and removes rooms past their lifetime, and frees the space', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const old = registry.create(mock);
    if (!old.ok) throw new Error('create');
    const conn = new FakeConn();
    old.value.join('Quinn', conn);
    now = LIMITS.roomTtlMs - 1;
    const fresh = registry.create(mock);
    expect(registry.sweep()).toBe(0);
    now = LIMITS.roomTtlMs;
    expect(registry.sweep()).toBe(1);
    expect(registry.get(old.value.code)).toBeUndefined();
    expect(conn.sent.at(-1)).toEqual({ t: 'closed', reason: 'This room expired.' });
    expect(conn.closed).toBe(true);
    expect(fresh.ok && registry.get(fresh.value.code)).toBeTruthy();
  });

  it('drops the key of an expired or closed room', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const r = registry.create({ mode: 'openrouter', key: 'sk-secret-9', models: ['a/b'], maxCostUsd: 1 });
    if (!r.ok) throw new Error('create');
    now = LIMITS.roomTtlMs;
    registry.sweep();
    expect(r.value.takeSetup()).toEqual({ mode: 'mock' });
  });

  it('forgets a room that closed, so its code is unknown and it stops counting against the limit', () => {
    let n = 0;
    const registry = new Registry({ makeCode: () => `R${String(n++).padStart(4, '2')}` });
    const rooms = Array.from({ length: LIMITS.rooms }, () => registry.create(mock));
    const first = rooms[0];
    if (!first?.ok) throw new Error('create');
    expect(registry.create(mock).ok).toBe(false);
    first.value.close('everyone left');
    expect(registry.get(first.value.code)).toBeUndefined();
    expect(registry.create(mock).ok).toBe(true); // there is space again
    expect(registry.size).toBe(LIMITS.rooms);
  });

  it('sweep removes closed rooms and does not announce a second close', () => {
    const registry = new Registry();
    const r = registry.create(mock);
    if (!r.ok) throw new Error('create');
    const conn = new FakeConn();
    r.value.join('Quinn', conn);
    r.value.close('everyone left');
    expect(registry.sweep()).toBe(1);
    expect(registry.size).toBe(0);
    expect(conn.sent.filter((m) => m.t === 'closed')).toEqual([{ t: 'closed', reason: 'everyone left' }]);
  });

  it('removes a finished room fifteen minutes after its game ended, long before the room lifetime', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const r = registry.create(mock);
    const running = registry.create(mock);
    if (!r.ok || !running.ok) throw new Error('create');
    r.value.phase = 'finished';
    r.value.finishedAt = 1000;
    now = 1000 + LIMITS.finishedTtlMs - 1;
    expect(registry.sweep()).toBe(0);
    now = 1000 + LIMITS.finishedTtlMs;
    expect(registry.sweep()).toBe(1);
    expect(registry.get(r.value.code)).toBeUndefined();
    expect(registry.get(running.value.code)).toBe(running.value); // an unfinished room is not touched
  });

  it('limits how many open rooms one address may have, not counting finished ones or other addresses', () => {
    const registry = new Registry();
    const made = Array.from({ length: LIMITS.roomsPerOwner }, () => registry.create(mock, undefined, '10.0.0.1'));
    expect(made.every((r) => r.ok)).toBe(true);
    expect(registry.create(mock, undefined, '10.0.0.1')).toEqual({ ok: false, error: `You already have ${LIMITS.roomsPerOwner} rooms open. Finish or leave one first.` });
    expect(registry.create(mock, undefined, '10.0.0.2').ok).toBe(true); // another address is not affected
    expect(registry.create(mock).ok).toBe(true); // an unknown address is not limited here
    const first = made[0];
    if (!first?.ok) throw new Error('create');
    first.value.phase = 'finished';
    expect(registry.create(mock, undefined, '10.0.0.1').ok).toBe(true); // a finished room does not count
    first.value.close('left');
    expect(registry.create(mock, undefined, '10.0.0.1').ok).toBe(false); // the other two are still open
  });

  it('closes a lobby that has had nobody connected for two minutes, so it stops holding its owner\'s room limit', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const mine = Array.from({ length: LIMITS.roomsPerOwner }, () => registry.create(mock, undefined, '10.0.0.1'));
    const rooms = mine.map((r) => {
      if (!r.ok) throw new Error('create');
      r.value.join('Host', new FakeConn());
      return r.value;
    });
    expect(registry.create(mock, undefined, '10.0.0.1').ok).toBe(false);
    for (const room of rooms) room.detach(room.seats[0]!.conn!); // everyone leaves
    now = 1000;
    registry.sweep(); // first seen empty at 1000
    now = 1000 + LIMITS.emptyLobbyMs - 1;
    expect(registry.sweep()).toBe(0);
    now = 1000 + LIMITS.emptyLobbyMs;
    expect(registry.sweep()).toBe(LIMITS.roomsPerOwner);
    expect(registry.create(mock, undefined, '10.0.0.1').ok).toBe(true);
  });

  it('does not close a lobby someone comes back to, nor one that is running', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const a = registry.create(mock);
    const b = registry.create(mock);
    if (!a.ok || !b.ok) throw new Error('create');
    const conn = new FakeConn();
    const joined = a.value.join('Quinn', conn);
    b.value.join('Rae', new FakeConn());
    if (!joined.ok) throw new Error('join');
    b.value.phase = 'playing'; // a game under way is handled by the abandon timer, not this
    a.value.detach(conn);
    now = 1000;
    registry.sweep();
    now = 1000 + LIMITS.emptyLobbyMs - 1;
    a.value.rejoin(joined.value.token, new FakeConn()); // comes back just in time
    expect(registry.sweep()).toBe(0);
    now = 1000 + 5 * LIMITS.emptyLobbyMs;
    expect(registry.sweep()).toBe(0); // the lobby has a person again, and the playing room is left alone
    expect(registry.size).toBe(2);
  });
});
