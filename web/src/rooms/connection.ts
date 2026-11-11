import type { ServerMessage } from '../../../server/protocol.js';
import type { RoomEvent } from './state.js';

/** The part of a WebSocket this code uses, so tests can stand in for one. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
}

/** What survives a page reload in this tab: which seat is ours. Never the OpenRouter key. */
export interface Saved {
  code: string;
  token: string;
}
export interface Store {
  load(): Saved | null;
  save(saved: Saved): void;
  clear(): void;
}

export interface ConnectionOptions {
  url: string;
  onEvent: (event: RoomEvent) => void;
  store: Store;
  createSocket?: (url: string) => SocketLike;
  /** Milliseconds to wait before reconnect attempt number `attempt` (from 1). */
  backoff?: (attempt: number) => number;
}

const defaultBackoff = (attempt: number): number => Math.min(10_000, 500 * 2 ** (attempt - 1));
/** Errors that mean the saved seat is gone for good, so the page should stop trying to get it back. */
const SEAT_GONE = ['That room has closed.', 'That seat is not at this table.'];

/**
 * The page's connection to the room server. Messages sent before the socket opens wait for it. If the socket drops,
 * it reconnects and takes the saved seat back; the server then sends what the person missed.
 */
export class RoomConnection {
  private socket: SocketLike | null = null;
  private open = false;
  private queue: string[] = [];
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private done = false;
  private readonly create: (url: string) => SocketLike;
  private readonly backoff: (attempt: number) => number;

  constructor(private readonly opts: ConnectionOptions) {
    this.create = opts.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.backoff = opts.backoff ?? defaultBackoff;
  }

  /** Send a message, connecting first if needed. */
  send(message: object): void {
    this.done = false;
    const text = JSON.stringify(message);
    if (this.socket && this.open) this.socket.send(text);
    else {
      this.queue.push(text);
      this.connect();
    }
  }

  /** Take the saved seat back (after a reload). Returns false when there is none. */
  resume(): boolean {
    const saved = this.opts.store.load();
    if (!saved) return false;
    this.send({ t: 'rejoin', code: saved.code, token: saved.token });
    return true;
  }

  /** The person leaves: forget the seat and close the connection. */
  leave(): void {
    this.done = true;
    this.opts.store.clear();
    this.queue = [];
    this.stopTimer();
    this.socket?.close();
    this.socket = null;
    this.open = false;
    this.opts.onEvent({ kind: 'leave' });
  }

  /** The page is going away: close the socket and stop retrying, but keep the saved seat so a reload can resume. */
  dispose(): void {
    this.done = true;
    this.queue = [];
    this.stopTimer();
    const socket = this.socket;
    this.socket = null;
    this.open = false;
    socket?.close();
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private connect(): void {
    if (this.socket) return;
    const socket = this.create(this.opts.url);
    this.socket = socket;
    let opened = false;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      opened = true;
      this.open = true;
      const wasRetrying = this.attempts > 0;
      this.attempts = 0;
      if (wasRetrying) this.opts.onEvent({ kind: 'online' });
      for (const text of this.queue.splice(0)) socket.send(text);
    };
    socket.onmessage = (e) => this.onData(e.data);
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.open = false;
      if (this.done) return;
      if (!opened && this.queue.length > 0) {
        // Never connected, so what was waiting (a create message holds the host's key) was not sent. Drop it rather than keep
        // the key in memory for a later send to flush, and say so: the person has to enter it again.
        this.queue = [];
        this.opts.onEvent({ kind: 'message', msg: { t: 'error', message: 'Your request was not sent because the room server could not be reached. Enter it again.' } });
      }
      this.opts.onEvent({ kind: 'offline' });
      this.retry();
    };
  }

  private retry(): void {
    const saved = this.opts.store.load();
    if (!saved || this.timer) return;
    this.attempts++;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.send({ t: 'rejoin', code: saved.code, token: saved.token });
    }, this.backoff(this.attempts));
  }

  private onData(data: unknown): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(data)) as ServerMessage;
    } catch {
      return;
    }
    if (msg.t === 'joined') this.opts.store.save({ code: msg.code, token: msg.token });
    if (msg.t === 'closed' || (msg.t === 'error' && SEAT_GONE.includes(msg.message))) {
      this.opts.store.clear();
      this.done = true;
      this.stopTimer();
    }
    this.opts.onEvent({ kind: 'message', msg });
  }
}

/** The seat is kept in sessionStorage: it belongs to this tab and goes when the tab does. Unavailable storage just means no resume. */
export function sessionStore(key = 'round-table-room'): Store {
  return {
    load() {
      try {
        const v = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Partial<Saved> | null;
        return v && typeof v.code === 'string' && typeof v.token === 'string' ? { code: v.code, token: v.token } : null;
      } catch {
        return null;
      }
    },
    save(saved) {
      try {
        sessionStorage.setItem(key, JSON.stringify(saved));
      } catch {
        /* storage blocked: the seat just cannot be resumed after a reload */
      }
    },
    clear() {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* nothing to clear */
      }
    },
  };
}
