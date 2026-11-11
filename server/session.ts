import type { GameLog } from '../src/engine/types.js';
import { runRoomGame } from './game.js';
import type { HumanAnswer } from '../src/players/human.js';
import { RateLimiter } from './rateLimit.js';
import { LIMITS, parseClientMessage, type AiSetup, type ClientMessage, type ServerMessage } from './protocol.js';
import type { Registry } from './registry.js';
import { Room, type Conn, type Seat } from './room.js';
import { SeatPlayer } from './seatPlayer.js';

/** What the server keeps for a room beyond the room itself: each person's turn handler, and the finished log. */
export interface Runtime {
  seatPlayers: Map<string, SeatPlayer>;
  abort: AbortController;
  log: GameLog | null;
  /** Set while every person is disconnected during a game; when it fires the room closes. */
  abandonTimer: ReturnType<typeof setTimeout> | null;
}

export interface SessionOptions {
  turnMs: number;
  /**
   * Honour a seed sent by the page. Off by default: the seed decides every role, so anyone who picks it can work the roles out
   * with the public engine code. Only for tests and replays on a machine you control.
   */
  allowSeed?: boolean;
  /** How long a running game may have nobody connected before the room closes and the AIs stop. */
  abandonMs: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  now?: () => number;
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
  private readonly limiter: RateLimiter;

  constructor(
    private readonly conn: Conn,
    private readonly deps: SessionDeps,
    /** The network address this connection came from, if known. */
    private readonly owner: string | null = null,
  ) {
    this.limiter = new RateLimiter(LIMITS.messagesPerWindow, LIMITS.windowMs, deps.options.now);
  }

  /** Handle one incoming text message. Never throws: a bad message gets an error reply. */
  handle(text: string): void {
    const verdict = this.limiter.check();
    if (verdict === 'refuse') return this.tell({ t: 'error', message: 'You are sending messages too fast. Wait a moment.' });
    if (verdict === 'refuse-quietly') return;
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
    const { room } = this;
    if (!room) return;
    room.detach(this.conn);
    if (room.phase === 'lobby') room.broadcast(room.lobbyMessage()); // so friends see who is offline
    // A game with nobody watching still spends the host's money on the AIs, so it does not run on forever.
    const rt = this.deps.runtimes.get(room.code);
    if (rt && room.phase === 'playing' && room.seats.every((s) => s.conn === null) && !rt.abandonTimer) {
      rt.abandonTimer = setTimeout(() => room.close('Everyone left the game.'), this.deps.options.abandonMs);
      rt.abandonTimer.unref();
    }
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
        return this.start();
      case 'answer':
        return this.answer(msg.turn, msg.answer);
    }
  }

  private runtime(room: Room): Runtime {
    let rt = this.deps.runtimes.get(room.code);
    if (!rt) {
      rt = { seatPlayers: new Map(), abort: new AbortController(), log: null, abandonTimer: null };
      const made = rt;
      this.deps.runtimes.set(room.code, made);
      room.onClose(() => {
        made.abort.abort();
        if (made.abandonTimer) clearTimeout(made.abandonTimer);
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
    const made = this.deps.registry.create(setup, this.deps.options.allowSeed ? msg.seed : undefined, this.owner);
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

  private start(): void {
    const { room, seat } = this;
    if (!room || !seat) return this.tell({ t: 'error', message: 'Create or join a room first.' });
    const problem = room.startProblem(seat);
    if (problem) return this.tell({ t: 'error', message: problem });
    room.phase = 'playing';
    room.broadcast({ t: 'status', phase: null });
    const rt = this.runtime(room);
    const { options } = this.deps;
    runRoomGame(room, {
      seatPlayers: rt.seatPlayers,
      signal: rt.abort.signal,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.aiTimeoutMs !== undefined ? { aiTimeoutMs: options.aiTimeoutMs } : {}),
    }).then(
      (log) => {
        if (room.phase !== 'playing') return; // the room closed while the game ran
        rt.log = log;
        room.phase = 'finished';
        room.finishedAt = (options.now ?? Date.now)();
        for (const s of room.seats) room.sendTo(s.name, { t: 'finished', log, you: s.name });
      },
      (e: unknown) => {
        options.log(`game error: ${e instanceof Error ? e.name : 'unknown'}`);
        room.close('The game stopped because of an error.');
      },
    );
  }

  private answer(turn: number, answer: HumanAnswer): void {
    const { room, seat } = this;
    if (!room || !seat) return this.tell({ t: 'error', message: 'Create or join a room first.' });
    if (room.phase !== 'playing') return this.tell({ t: 'error', message: 'The game is not running.' });
    // An answer for a turn that already timed out or was answered is ignored: it is not an error to be late.
    this.deps.runtimes.get(room.code)?.seatPlayers.get(seat.name)?.answer(turn, answer);
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
    if (rt?.abandonTimer) {
      clearTimeout(rt.abandonTimer);
      rt.abandonTimer = null;
    }
    if (room.phase === 'lobby') room.broadcast(room.lobbyMessage());
    else if (room.phase === 'finished' && rt?.log) this.tell({ t: 'finished', log: rt.log, you: seat.name });
    else {
      this.tell({ t: 'status', phase: room.status });
      rt?.seatPlayers.get(seat.name)?.resend();
    }
  }
}

type Result = { ok: true; value: Seat } | { ok: false; error: string };
