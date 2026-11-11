import type { Conn } from '../../server/room.js';
import type { ServerMessage } from '../../server/protocol.js';

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
