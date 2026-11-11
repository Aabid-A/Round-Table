import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Guessing, RECONNECT_GRACE_MS } from '../../server/guessing.js';
import { Room } from '../../server/room.js';
import type { Guess } from '../../src/roomResult.js';
import { logFrom } from '../helpers/logs.js';
import { FakeConn } from './helpers.js';

// Four seats named as aliases: Aria and Bram are AIs; Cleo is Quinn and Dax is Rae.
const log = logFrom({ Aria: 'traitor', Bram: 'faithful', Cleo: 'faithful', Dax: 'traitor' }, [], {}, { Cleo: 'human', Dax: 'human' });

function setup(timeoutMs = 1000) {
  const room = new Room('AB2CD', { mode: 'mock' }, 1, 0);
  room.aliases = true;
  room.people = { Cleo: 'Quinn', Dax: 'Rae' };
  const conns = { Quinn: new FakeConn(), Rae: new FakeConn() };
  room.join('Quinn', conns.Quinn);
  room.join('Rae', conns.Rae);
  const done: Guess[][] = [];
  const guessing = new Guessing(room, log, timeoutMs, (g) => done.push(g));
  return { room, conns, done, guessing };
}

describe('Guessing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks each person, naming their own alias and all the seats', () => {
    const { conns, guessing } = setup();
    guessing.start();
    expect(conns.Quinn.sent).toEqual([{ t: 'guess', seats: ['Aria', 'Bram', 'Cleo', 'Dax'], you: 'Cleo', timeoutMs: 1000, sent: false }]);
    expect(conns.Rae.sent[0]).toMatchObject({ t: 'guess', you: 'Dax' });
  });

  it('finishes, once, when everyone has answered, and drops unknown seats and the person\'s own', () => {
    const { done, guessing } = setup();
    guessing.start();
    expect(guessing.submit('Quinn', ['Aria', 'Cleo', 'Nobody'])).toBe(true);
    expect(done).toEqual([]);
    expect(guessing.submit('Rae', ['Bram'])).toBe(true);
    expect(done).toEqual([[{ seat: 'Cleo', ai: ['Aria'] }, { seat: 'Dax', ai: ['Bram'] }]]);
    expect(guessing.submit('Quinn', ['Bram'])).toBe(false); // too late, and not a second go
    vi.advanceTimersByTime(5000);
    expect(done).toHaveLength(1);
  });

  it('takes a person\'s answer only once, and from someone who has an alias', () => {
    const { guessing } = setup();
    guessing.start();
    expect(guessing.submit('Quinn', ['Aria'])).toBe(true);
    expect(guessing.submit('Quinn', ['Bram'])).toBe(false);
    expect(guessing.submit('Stranger', ['Aria'])).toBe(false);
  });

  it('finishes at the time limit with the answers that came in', () => {
    const { done, guessing } = setup();
    guessing.start();
    guessing.submit('Quinn', ['Aria']);
    vi.advanceTimersByTime(999);
    expect(done).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(done).toEqual([[{ seat: 'Cleo', ai: ['Aria'] }]]);
  });

  it('does not wait for someone who has gone, once the grace for coming back is over', () => {
    const { room, conns, done, guessing } = setup(60_000); // a limit well beyond the grace
    guessing.start();
    guessing.submit('Quinn', ['Aria']);
    room.detach(conns.Rae);
    guessing.connectionLost(); // what the session does when a connection closes
    expect(done).toEqual([]); // not yet: they may be reloading
    vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1);
    expect(done).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(done).toEqual([[{ seat: 'Cleo', ai: ['Aria'] }]]);
  });

  it('keeps waiting for someone who comes back within the grace, so a reload does not cost them their guess', () => {
    const { room, conns, done, guessing } = setup(60_000);
    guessing.start();
    guessing.submit('Quinn', ['Aria']);
    const rae = room.seats[1]!;
    room.detach(conns.Rae);
    guessing.connectionLost();
    vi.advanceTimersByTime(RECONNECT_GRACE_MS - 1000);
    room.rejoin(rae.token, new FakeConn()); // back in time
    vi.advanceTimersByTime(2000);
    expect(done).toEqual([]); // still waiting for Rae's answer
    expect(guessing.submit('Rae', ['Bram'])).toBe(true);
    expect(done).toEqual([[{ seat: 'Cleo', ai: ['Aria'] }, { seat: 'Dax', ai: ['Bram'] }]]);
  });

  it('does not finish on someone else\'s answer while a person who just dropped might be back, but does once they have answered', () => {
    const { room, conns, done, guessing } = setup(60_000);
    guessing.start();
    const rae = room.seats[1]!;
    room.detach(conns.Rae);
    guessing.connectionLost(); // Rae is reloading
    guessing.submit('Quinn', ['Aria']); // the last person still here answers: Rae's grace has not run out
    expect(done).toEqual([]);
    room.rejoin(rae.token, new FakeConn());
    expect(guessing.submit('Rae', ['Bram'])).toBe(true); // back in time, and answering finishes it at once
    expect(done).toEqual([[{ seat: 'Cleo', ai: ['Aria'] }, { seat: 'Dax', ai: ['Bram'] }]]);
  });

  it('finishes at once, with nothing, if nobody is connected when it starts', () => {
    const { room, conns, done, guessing } = setup();
    room.detach(conns.Quinn);
    room.detach(conns.Rae);
    guessing.start();
    expect(done).toEqual([[]]);
  });

  it('asks a returning person again with the time that is left, and says if they already answered', () => {
    const { room, conns, guessing } = setup();
    guessing.start();
    vi.advanceTimersByTime(400);
    const back = new FakeConn();
    const quinn = room.seats[0]!;
    room.detach(conns.Quinn);
    room.rejoin(quinn.token, back);
    guessing.resend('Quinn');
    expect(back.sent.at(-1)).toMatchObject({ t: 'guess', timeoutMs: 600, sent: false });
    guessing.submit('Quinn', []);
    guessing.resend('Quinn'); // still running, since Rae has not answered
    expect(back.sent.at(-1)).toMatchObject({ t: 'guess', sent: true });
  });

  it('stops quietly when cancelled, grace timer included', () => {
    const { done, guessing } = setup();
    guessing.start();
    guessing.connectionLost();
    guessing.cancel();
    vi.advanceTimersByTime(5000);
    expect(done).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
