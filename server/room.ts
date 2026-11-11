import { randomUUID } from 'node:crypto';
import { AI_NAMES } from '../src/cast.js';
import { MAX_HUMANS, type AiSetup, type SeatInfo, type ServerMessage } from './protocol.js';

/** One open connection, as the room sees it. Tests use fakes; the server wraps a WebSocket. */
export interface Conn {
  send(message: ServerMessage): void;
  close(): void;
}

export interface Seat {
  name: string;
  /** Proves this person owns the seat when they come back. Sent only to them, once, in `joined`. */
  readonly token: string;
  host: boolean;
  conn: Conn | null;
}

export type RoomPhase = 'lobby' | 'playing' | 'finished' | 'closed';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const refuse = (error: string): { ok: false; error: string } => ({ ok: false, error });

export class Room {
  readonly seats: Seat[] = [];
  phase: RoomPhase = 'lobby';
  /**
   * The AI setup, including the host's OpenRouter key. A private field, so it is not in JSON or in console output,
   * and the only way out is `takeSetup`, which the game runner calls once. `dropKey` erases it.
   */
  #setup: AiSetup;

  constructor(
    readonly code: string,
    setup: AiSetup,
    readonly seed: number,
    readonly createdAt: number,
  ) {
    this.#setup = setup;
  }

  get mode(): 'mock' | 'openrouter' {
    return this.#setup.mode;
  }

  /** The AI setup for the game runner. */
  takeSetup(): AiSetup {
    return this.#setup;
  }

  /** Forget the key. Called when the game ends or the room closes; later calls to takeSetup get a mock setup. */
  dropKey(): void {
    this.#setup = { mode: 'mock' };
  }

  toJSON(): unknown {
    return { code: this.code, phase: this.phase, seats: this.seats.map((s) => s.name) };
  }

  get aiSeats(): number {
    return MAX_HUMANS - this.seats.length;
  }

  private byName(name: string): Seat | undefined {
    return this.seats.find((s) => s.name.toLowerCase() === name.toLowerCase());
  }

  /** Add a person to the lobby. The first one is the host. */
  join(name: string, conn: Conn): Result<Seat> {
    if (this.phase !== 'lobby') return refuse('That game has already started.');
    if (this.seats.length >= MAX_HUMANS) return refuse('That room is full.');
    if (this.byName(name) || AI_NAMES.some((n) => n.toLowerCase() === name.toLowerCase())) return refuse(`${name} is taken at this table. Choose another name.`);
    const seat: Seat = { name, token: randomUUID(), host: this.seats.length === 0, conn };
    this.seats.push(seat);
    return { ok: true, value: seat };
  }

  /** Give a returning person their seat back. A newer connection replaces an older one. */
  rejoin(token: string, conn: Conn): Result<Seat> {
    if (this.phase === 'closed') return refuse('That room has closed.');
    const seat = this.seats.find((s) => s.token === token);
    if (!seat) return refuse('That seat is not at this table.');
    const old = seat.conn;
    seat.conn = conn;
    if (old && old !== conn) old.close();
    return { ok: true, value: seat };
  }

  /** A connection went away. The seat stays, so the person can come back. */
  detach(conn: Conn): void {
    for (const s of this.seats) if (s.conn === conn) s.conn = null;
  }

  seatOf(conn: Conn): Seat | undefined {
    return this.seats.find((s) => s.conn === conn);
  }

  seatInfo(): SeatInfo[] {
    return this.seats.map((s) => ({ name: s.name, connected: s.conn !== null, host: s.host }));
  }

  lobbyMessage(): ServerMessage {
    return { t: 'lobby', code: this.code, mode: this.mode, seats: this.seatInfo(), aiSeats: this.aiSeats, maxHumans: MAX_HUMANS };
  }

  broadcast(message: ServerMessage): void {
    for (const s of this.seats) s.conn?.send(message);
  }

  /** Private to one seat. */
  sendTo(name: string, message: ServerMessage): void {
    this.byName(name)?.conn?.send(message);
  }

  /** Why this person cannot start the game now, or null. */
  startProblem(seat: Seat): string | null {
    if (!seat.host) return 'Only the host can start the game.';
    if (this.phase !== 'lobby') return 'The game has already started.';
    return null;
  }

  /** End the room: tell everyone, close their connections, forget the key. */
  close(reason: string): void {
    if (this.phase === 'closed') return;
    this.phase = 'closed';
    this.dropKey();
    this.broadcast({ t: 'closed', reason });
    for (const s of this.seats) {
      s.conn?.close();
      s.conn = null;
    }
  }
}
