import type { Conn } from '../../server/room.js';
import type { ServerMessage } from '../../server/protocol.js';
import { emptyAnswer, formFor } from '../../web/src/play/human.js';
import { SeatPlayer } from '../../server/seatPlayer.js';
import { Room } from '../../server/room.js';

/** A connection that records what it was sent. */
export class FakeConn implements Conn {
  sent: ServerMessage[] = [];
  closed = false;
  send(message: ServerMessage): void {
    this.sent.push(message);
  }
  close(): void {
    this.closed = true;
  }
}

/** A person who answers every turn at once: the first choice, a short speech, a note naming the turn. `forward` delivers the message, as the server does. */
export function autoSeat(name: string, forward: (m: ServerMessage) => void, timeoutMs = 60_000): SeatPlayer {
  const seat: SeatPlayer = new SeatPlayer({
    timeoutMs,
    send: (m) => {
      forward(m);
      if (m.t !== 'turn') return;
      const spec = formFor(m.phase, m.options);
      seat.answer(m.turn, { ...emptyAnswer(), speech: spec.speechLabel ? `${name} speaks` : '', message: spec.messageLabel ? 'because' : '', note: `HUMANNOTE-${name}-${m.turn}`, choice: spec.choices[0]!.value });
    },
  });
  return seat;
}

/** A room with these people, each on a fake connection and answering at once. */
export function autoRoom(names: string[], setup: ConstructorParameters<typeof Room>[1] = { mode: 'mock' }, seed = 3) {
  const room = new Room('AB2CD', setup, seed, 0);
  const conns = new Map<string, FakeConn>();
  const seatPlayers = new Map<string, SeatPlayer>();
  for (const name of names) {
    const conn = new FakeConn();
    conns.set(name, conn);
    room.join(name, conn);
    seatPlayers.set(name, autoSeat(name, (m) => room.sendTo(name, m)));
  }
  return { room, conns, seatPlayers };
}

/** Resolves when `ready()` is true, checking every few milliseconds; fails after `ms`. */
export async function waitFor(ready: () => boolean, ms = 20_000): Promise<void> {
  const until = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 5));
  }
}
