import type { GameLog } from '../src/engine/types.js';
import { parseClientMessage, type AiSetup, type ClientMessage, type ServerMessage } from './protocol.js';
import type { Registry } from './registry.js';
import { Room, type Conn, type Seat } from './room.js';
import { SeatPlayer } from './seatPlayer.js';

/** What the server keeps for a room beyond the room itself: each person's turn handler, and the finished log. */
export interface Runtime {
  seatPlayers: Map<string, SeatPlayer>;
  abort: AbortController;
  log: GameLog | null;
}

export interface SessionOptions {
  turnMs: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  aiTimeoutMs?: number;
  /** Where the server writes what happened. Never given a message's content. */
  log: (line: string) => void;
}

export interface SessionDeps {
  registry: Registry;
  runtimes: Map<string, Runtime>;
  options: SessionOptions;
}

/** One connection's conversation with the server: it may create or join one room and play one seat. */
export class Session {
  private room: Room | null = null;
  private seat: Seat | null = null;

  constructor(
    private readonly conn: Conn,
    private readonly deps: SessionDeps,
  ) {}

  /** Handle one incoming text message. Never throws: a bad message gets an error reply. */
  handle(text: string): void {
    const parsed = parseClientMessage(text);
    if (!parsed.ok) return this.tell({ t: 'error', message: parsed.error });
    try {
      this.dispatch(parsed.msg);
    } catch (e) {
      this.deps.options.log(`session error: ${e instanceof Error ? e.name : 'unknown'}`);
      this.tell({ t: 'error', message: 'Something went wrong. Try again.' });
    }
  }

  /** The connection closed. The seat stays, so the person can come back. */
  disconnect(): void {
    this.room?.detach(this.conn);
  }

  private tell(message: ServerMessage): void {
    this.conn.send(message);
  }

  private dispatch(msg: ClientMessage): void {
    switch (msg.t) {
      case 'create':
        return this.create(msg);
      case 'join':
        return this.join(msg.code, msg.name);
      case 'rejoin':
        return this.rejoin(msg.code, msg.token);
      case 'start':
      case 'answer':
        return this.tell({ t: 'error', message: 'There is no game to do that in yet.' });
    }
  }

  private runtime(room: Room): Runtime {
    let rt = this.deps.runtimes.get(room.code);
    if (!rt) {
      rt = { seatPlayers: new Map(), abort: new AbortController(), log: null };
      const made = rt;
      this.deps.runtimes.set(room.code, made);
      room.onClose(() => {
        made.abort.abort();
        for (const p of made.seatPlayers.values()) p.cancel();
        this.deps.runtimes.delete(room.code);
      });
    }
    return rt;
  }

  private sit(room: Room, name: string): Result {
    const joined = room.join(name, this.conn);
    if (!joined.ok) return joined;
    const seat = joined.value;
    this.runtime(room).seatPlayers.set(name, new SeatPlayer({ timeoutMs: this.deps.options.turnMs, send: (m) => room.sendTo(name, m) }));
    this.room = room;
    this.seat = seat;
    this.tell({ t: 'joined', code: room.code, token: seat.token, you: seat.name, host: seat.host });
    room.broadcast(room.lobbyMessage());
    return joined;
  }

  private create(msg: Extract<ClientMessage, { t: 'create' }>): void {
    if (this.room) return this.tell({ t: 'error', message: 'You already have a seat.' });
    const setup: AiSetup = msg.mode === 'mock' ? { mode: 'mock' } : { mode: 'openrouter', key: msg.key, models: msg.models, maxCostUsd: msg.maxCostUsd };
    const made = this.deps.registry.create(setup, msg.seed);
    if (!made.ok) return this.tell({ t: 'error', message: made.error });
    const sat = this.sit(made.value, msg.name);
    if (!sat.ok) made.value.close(sat.error);
  }

  private join(code: string, name: string): void {
    if (this.room) return this.tell({ t: 'error', message: 'You already have a seat.' });
    const room = this.deps.registry.get(code);
    if (!room) return this.tell({ t: 'error', message: 'No room has that code. Check it and try again.' });
    const sat = this.sit(room, name);
    if (!sat.ok) this.tell({ t: 'error', message: sat.error });
  }

  private rejoin(code: string, token: string): void {
    if (this.room) return this.tell({ t: 'error', message: 'You already have a seat.' });
    const room = this.deps.registry.get(code);
    if (!room) return this.tell({ t: 'error', message: 'That room has closed.' });
    const back = room.rejoin(token, this.conn);
    if (!back.ok) return this.tell({ t: 'error', message: back.error });
    const seat = back.value;
    this.room = room;
    this.seat = seat;
    this.tell({ t: 'joined', code: room.code, token: seat.token, you: seat.name, host: seat.host });
    const rt = this.deps.runtimes.get(room.code);
    if (room.phase === 'lobby') room.broadcast(room.lobbyMessage());
    else if (room.phase === 'finished' && rt?.log) this.tell({ t: 'finished', log: rt.log, you: seat.name });
    else {
      this.tell({ t: 'status', phase: null });
      rt?.seatPlayers.get(seat.name)?.resend();
    }
  }
}

type Result = { ok: true; value: Seat } | { ok: false; error: string };
