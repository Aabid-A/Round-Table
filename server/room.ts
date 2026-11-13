import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AI_NAMES } from '../src/cast.js';
import type { PublicPhase } from '../src/publicPhase.js';
import { LIMITS, MAX_HUMANS, type AiSetup, type SeatInfo, type ServerMessage } from './protocol.js';
import type { GameLog } from '../src/engine/types.js';
import type { Watching } from './watching.js';

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

export type RoomPhase = 'lobby' | 'playing' | 'guessing' | 'finished' | 'closed';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const refuse = (error: string): { ok: false; error: string } => ({ ok: false, error });

export class Room {
  readonly seats: Seat[] = [];
  phase: RoomPhase = 'lobby';
  /** The phase everyone was last told, so a person who comes back mid-phase can be told too. */
  status: PublicPhase | null = null;
  /** Every seat plays under an alias, so nobody can tell friends from AIs until the end. */
  aliases = false;
  /** Alias to real name, kept private until the game is over. Empty without aliases. */
  people: Record<string, string> = {};
  /** People who are out of the game may watch every seat's view. Off unless the host asked for it. */
  ghosts = false;
  /** A read-only link shows the game one full round behind. Off unless the host asked for it. */
  spectators = false;
  /** What the room knows about its game as it happens, while a ghost or spectator option makes that worth keeping. */
  watching: Watching | null = null;
  /** People (by seat name) who are out of the game. They are told what a ghost may see, if the room allows ghosts. */
  readonly outPeople = new Set<string>();
  private readonly watchers: Conn[] = [];
  /** The newest round a spectator has been sent, so each new round is sent once. */
  private spectatorRound = -1;
  /** Proves a read-only watcher holds the link the host shared. Private, so it is not in JSON or console output. */
  #watchToken: string | null = null;
  /** Who made the room (a network address), for the per-address room limit. */
  owner: string | null = null;
  /** When the game ended, for expiry. */
  finishedAt: number | null = null;
  private readonly closers: (() => void)[] = [];
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

  /** Give the room a read-only link. Called once, when the host asks for one. */
  enableSpectators(): void {
    this.spectators = true;
    this.#watchToken ??= randomUUID();
  }

  /** The watch token, for the host to share. Nobody else is told it. */
  watchTokenFor(seat: Seat): string | undefined {
    return seat.host && this.spectators ? (this.#watchToken ?? undefined) : undefined;
  }

  isWatchToken(token: string): boolean {
    if (!this.spectators || this.#watchToken === null) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(this.#watchToken);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Add a read-only watcher. */
  addWatcher(conn: Conn): Result<true> {
    if (this.phase === 'closed') return refuse('That room has closed.');
    if (this.watchers.length >= LIMITS.watchersPerRoom) return refuse('That room has as many watchers as it can take.');
    this.watchers.push(conn);
    return { ok: true, value: true };
  }

  removeWatcher(conn: Conn): void {
    const i = this.watchers.indexOf(conn);
    if (i !== -1) this.watchers.splice(i, 1);
  }

  get watcherCount(): number {
    return this.watchers.length;
  }

  /** What a watcher is shown now: nothing before the game, the game one round behind while it runs, all of it when it is over. */
  spectateMessage(finished: GameLog | null): ServerMessage {
    return finished ? { t: 'spectate', log: finished, complete: true } : { t: 'spectate', log: this.watching?.spectatorLog() ?? null, complete: false };
  }

  /** Tell the watchers when a new full round has become visible (or the game is over). */
  publishSpectators(finished: GameLog | null = null): void {
    if (!this.spectators) return;
    const round = finished ? Number.POSITIVE_INFINITY : (this.watching?.visibleRound ?? 0);
    if (round <= this.spectatorRound) return;
    this.spectatorRound = round;
    if (this.watchers.length === 0) return; // anyone who connects later is sent the game as it stands then
    const message = this.spectateMessage(finished);
    for (const w of this.watchers) w.send(message);
  }

  /** A ghost's view of every seat, for a person who is out. Null when the room does not allow ghosts or this person is still playing. */
  ghostMessage(person: string): ServerMessage | null {
    if (!this.ghosts || !this.outPeople.has(person) || !this.watching) return null;
    return { t: 'ghost', you: this.aliasOf(person) ?? person, seats: this.watching.ghostSeats() };
  }

  /** Send every ghost the views as they are now. Only people who are out are ever in the list. */
  publishGhosts(): void {
    for (const person of this.outPeople) {
      const message = this.ghostMessage(person);
      if (message) this.sendTo(person, message);
    }
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

  /** The alias this person plays under, once an alias game has started. */
  aliasOf(name: string): string | null {
    return Object.entries(this.people).find(([, person]) => person === name)?.[0] ?? null;
  }

  /** A person leaves the lobby for good: their seat goes. */
  removeSeat(name: string): void {
    const i = this.seats.findIndex((s) => s.name === name);
    if (i !== -1) this.seats.splice(i, 1);
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
    return { t: 'lobby', code: this.code, mode: this.mode, aliases: this.aliases, ghosts: this.ghosts, spectators: this.spectators, seats: this.seatInfo(), aiSeats: this.aiSeats, maxHumans: MAX_HUMANS };
  }

  broadcast(message: ServerMessage): void {
    for (const s of this.seats) s.conn?.send(message);
  }

  /** Tell everyone the phase has changed (and remember it for anyone who rejoins). */
  announce(phase: PublicPhase): void {
    this.status = phase;
    this.broadcast({ t: 'status', phase });
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

  /** Run `fn` when the room closes (the game stops, timers end). Runs at once if it is already closed. */
  onClose(fn: () => void): void {
    if (this.phase === 'closed') fn();
    else this.closers.push(fn);
  }

  /** End the room: tell everyone, close their connections, forget the key. */
  close(reason: string): void {
    if (this.phase === 'closed') return;
    this.phase = 'closed';
    this.dropKey();
    for (const fn of this.closers.splice(0)) fn();
    this.broadcast({ t: 'closed', reason });
    for (const w of this.watchers.splice(0)) {
      w.send({ t: 'closed', reason });
      w.close();
    }
    for (const s of this.seats) {
      s.conn?.close();
      s.conn = null;
    }
  }
}
