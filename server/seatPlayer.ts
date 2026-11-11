import { buildHumanReply, type HumanAnswer } from '../src/players/human.js';
import type { Player, PromptRequest } from '../src/players/player.js';
import type { ServerMessage } from './protocol.js';

interface Pending {
  turn: number;
  request: PromptRequest;
  startedAt: number;
  resolve: (reply: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface SeatPlayerOptions {
  /** Delivers a private message to this seat's current connection, if it has one. */
  send: (message: ServerMessage) => void;
  timeoutMs: number;
  /** Injectable for tests. */
  now?: () => number;
}

/**
 * A person at a seat, as the engine sees them: a Player whose answer arrives over a connection.
 * No answer in time makes `respond` throw, so the engine retries and then uses its fallback, as for a model that timed out.
 * The retry is not waited for again: one missed turn costs one timeout, not two.
 */
export class SeatPlayer {
  private pending: Pending | null = null;
  private lastTurn = 0;
  private timedOut: string | null = null;
  private readonly now: () => number;

  constructor(private readonly opts: SeatPlayerOptions) {
    this.now = opts.now ?? Date.now;
  }

  readonly player: Player = {
    respond: (request) => this.ask(request),
  };

  private ask(request: PromptRequest): Promise<string> {
    // The engine's retry of a turn that timed out is the same prompt plus a note: do not wait again.
    if (this.timedOut !== null && request.user.startsWith(this.timedOut)) {
      this.timedOut = null; // used up: the next turn waits again
      return Promise.reject(new Error('no answer in time'));
    }
    return new Promise((resolve, reject) => {
      const turn = ++this.lastTurn;
      const timer = setTimeout(() => this.expire(turn), this.opts.timeoutMs);
      this.pending = { turn, request, startedAt: this.now(), resolve, reject, timer };
      this.deliver(this.pending, this.opts.timeoutMs, retryNote(this.appendedSince(request)));
    });
  }

  private previousUser: string | null = null;
  /** What the engine added to the last prompt to ask again (an invalid answer), or null for a fresh turn. */
  private appendedSince(request: PromptRequest): string | null {
    const prev = this.previousUser;
    this.previousUser = request.user;
    return prev !== null && request.user.startsWith(prev) && request.user.length > prev.length ? request.user.slice(prev.length) : null;
  }

  private deliver(p: Pending, timeoutMs: number, error: string | null): void {
    this.opts.send({ t: 'turn', turn: p.turn, phase: p.request.phase, options: p.request.options, user: p.request.user, timeoutMs, error });
  }

  private expire(turn: number): void {
    const p = this.pending;
    if (!p || p.turn !== turn) return;
    this.pending = null;
    this.timedOut = p.request.user;
    this.opts.send({ t: 'turn_over', turn });
    p.reject(new Error('no answer in time'));
  }

  /** The person's answer. Ignored (false) when it is for a turn that is not waiting. */
  answer(turn: number, answer: HumanAnswer): boolean {
    const p = this.pending;
    if (!p || p.turn !== turn) return false;
    clearTimeout(p.timer);
    this.pending = null;
    this.timedOut = null;
    p.resolve(buildHumanReply(p.request.phase, answer));
    return true;
  }

  /** The person reconnected: send the turn again with the time that is left. */
  resend(): void {
    const p = this.pending;
    if (p) this.deliver(p, Math.max(0, this.opts.timeoutMs - (this.now() - p.startedAt)), null);
  }

  /** Give up on a waiting turn (the game ended or the room closed). */
  cancel(): void {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    p.reject(new Error('the game ended'));
  }
}

/** The text the engine appended to a prompt to ask for another try. */
function retryNote(appended: string | null): string | null {
  return appended === null ? null : appended.trim().split('\n')[0] ?? null;
}
