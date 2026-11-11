import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptRequest } from '../../src/players/player.js';
import type { ServerMessage } from '../../server/protocol.js';
import { SeatPlayer } from '../../server/seatPlayer.js';

const request = (user = 'You know things.\n\nTask: vote.'): PromptRequest => ({ system: 's', user, phase: 'vote', player: 'Quinn', options: ['Aria', 'Bram'] });
/** The seat player always answers with text. */
const ask = (seat: SeatPlayer, r: PromptRequest): Promise<string> => seat.player.respond(r) as Promise<string>;
const answer = (choice: string) => ({ speech: '', note: 'n', choice, message: '' });

describe('SeatPlayer', () => {
  let sent: ServerMessage[];
  let seat: SeatPlayer;
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    seat = new SeatPlayer({ send: (m) => sent.push(m), timeoutMs: 1000, now: () => Date.now() });
  });
  afterEach(() => vi.useRealTimers());

  it('sends the turn to the seat and turns the answer into the reply a model would give', async () => {
    const reply = ask(seat, request());
    expect(sent).toEqual([{ t: 'turn', turn: 1, phase: 'vote', options: ['Aria', 'Bram'], user: 'You know things.\n\nTask: vote.', timeoutMs: 1000, error: null }]);
    expect(seat.answer(1, answer('Bram'))).toBe(true);
    expect(JSON.parse(await reply)).toEqual({ speech: '', private_notes: 'n', action: { target: 'Bram' } });
  });

  it('ignores an answer for another turn, and a second answer for the same turn', async () => {
    const reply = ask(seat, request());
    expect(seat.answer(7, answer('Aria'))).toBe(false);
    expect(seat.answer(1, answer('Aria'))).toBe(true);
    expect(seat.answer(1, answer('Bram'))).toBe(false);
    expect(JSON.parse(await reply).action).toEqual({ target: 'Aria' });
  });

  it('fails the turn on timeout so the engine falls back, and tells the seat', async () => {
    const reply = ask(seat, request());
    const failed = expect(reply).rejects.toThrow('no answer in time');
    await vi.advanceTimersByTimeAsync(1000);
    await failed;
    expect(sent.at(-1)).toEqual({ t: 'turn_over', turn: 1 });
    expect(seat.answer(1, answer('Aria'))).toBe(false);
  });

  it("does not wait a second time for the engine's retry of a timed-out turn, but waits again for the next turn", async () => {
    const first = ask(seat, request('A\n\nTask.'));
    const failed = expect(first).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await failed;
    await expect(ask(seat, request('A\n\nTask.\n\nYour previous request failed: no answer in time.\nReply again.'))).rejects.toThrow('no answer in time');
    const sentBefore = sent.length;
    const next = ask(seat, request('B\n\nTask.'));
    expect(sent.length).toBe(sentBefore + 1);
    seat.answer(2, answer('Aria'));
    await next;
  });

  it('shows the engine\'s reason when it asks again after an invalid answer', async () => {
    const first = ask(seat, request('A\n\nTask.'));
    seat.answer(1, answer('Nobody'));
    await first;
    void ask(seat, request('A\n\nTask.\n\nYour previous reply was invalid: "Nobody" is not an option.\nReply again.')).catch(() => undefined);
    expect(sent.at(-1)).toMatchObject({ t: 'turn', turn: 2, error: 'Your previous reply was invalid: "Nobody" is not an option.' });
  });

  it('resends the waiting turn with the time left after a reconnect', async () => {
    ask(seat, request()).catch(() => undefined); // it times out at the end of the test
    await vi.advanceTimersByTimeAsync(400);
    seat.resend();
    expect(sent.at(-1)).toMatchObject({ t: 'turn', turn: 1, timeoutMs: 600 });
    seat.resend();
    await vi.advanceTimersByTimeAsync(1000);
    seat.resend();
    expect(sent.filter((m) => m.t === 'turn').length).toBe(3);
  });

  it('cancels a waiting turn when the game ends', async () => {
    const reply = ask(seat, request());
    const failed = expect(reply).rejects.toThrow('the game ended');
    seat.cancel();
    await failed;
    expect(vi.getTimerCount()).toBe(0);
  });
});
