import { describe, expect, it } from 'vitest';
import { Room } from '../../server/room.js';
import { FakeConn } from './helpers.js';

const newRoom = () => new Room('AB2CD', 1, 0);

describe('Room seats', () => {
  it('makes the first person the host and gives each seat its own token', () => {
    const room = newRoom();
    const a = room.join('Quinn', new FakeConn());
    const b = room.join('Rae', new FakeConn());
    if (!a.ok || !b.ok) throw new Error('joins should work');
    expect([a.value.host, b.value.host]).toEqual([true, false]);
    expect(a.value.token).not.toBe(b.value.token);
    expect(room.aiSeats).toBe(6);
  });

  it('refuses a taken name in any case, an AI name, a ninth person and a join after the start', () => {
    const room = newRoom();
    room.join('Quinn', new FakeConn());
    expect(room.join('QUINN', new FakeConn())).toEqual({ ok: false, error: 'QUINN is taken at this table. Choose another name.' });
    expect(room.join('aria', new FakeConn()).ok).toBe(false);
    for (const n of ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']) expect(room.join(n, new FakeConn()).ok).toBe(true);
    expect(room.join('P9', new FakeConn())).toEqual({ ok: false, error: 'That room is full.' });
    const other = newRoom();
    other.join('Quinn', new FakeConn());
    other.phase = 'playing';
    expect(other.join('Late', new FakeConn())).toEqual({ ok: false, error: 'That game has already started.' });
  });

  it('gives a seat back by token and closes the connection it replaces', () => {
    const room = newRoom();
    const first = new FakeConn();
    const joined = room.join('Quinn', first);
    if (!joined.ok) throw new Error('join');
    room.detach(first);
    expect(room.seatInfo()).toEqual([{ name: 'Quinn', connected: false, host: true }]);
    const second = new FakeConn();
    expect(room.rejoin(joined.value.token, second).ok).toBe(true);
    const third = new FakeConn();
    room.rejoin(joined.value.token, third);
    expect(second.closed).toBe(true);
    expect(room.seatOf(third)?.name).toBe('Quinn');
    expect(room.rejoin('00000000-0000-0000-0000-000000000000', new FakeConn())).toEqual({ ok: false, error: 'That seat is not at this table.' });
  });

  it('sends public messages to everyone and private ones to one seat', () => {
    const room = newRoom();
    const a = new FakeConn();
    const b = new FakeConn();
    room.join('Quinn', a);
    room.join('Rae', b);
    room.broadcast({ t: 'status', phase: 'night', round: 1 });
    room.sendTo('rae', { t: 'error', message: 'just you' });
    expect(a.sent).toEqual([{ t: 'status', phase: 'night', round: 1 }]);
    expect(b.sent.map((m) => m.t)).toEqual(['status', 'error']);
  });

  it('lets only the host start, once', () => {
    const room = newRoom();
    const host = room.join('Quinn', new FakeConn());
    const guest = room.join('Rae', new FakeConn());
    if (!host.ok || !guest.ok) throw new Error('join');
    expect(room.startProblem(guest.value)).toBe('Only the host can start the game.');
    expect(room.startProblem(host.value)).toBeNull();
    room.phase = 'playing';
    expect(room.startProblem(host.value)).toBe('The game has already started.');
  });
});
