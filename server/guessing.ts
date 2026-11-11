import type { GameLog } from '../src/engine/types.js';
import type { Guess } from '../src/roomResult.js';
import type { Room } from './room.js';

/**
 * After an alias game, before anyone is told who was who: each person says which seats they think were AIs.
 * It waits for every person who is still connected, up to `timeoutMs`; someone who has left, or is too slow, is simply not scored.
 * `onDone` runs once, with the guesses that came in, keyed by the guesser's alias.
 */
export class Guessing {
  private readonly guesses = new Map<string, string[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private done = false;

  constructor(
    private readonly room: Room,
    private readonly log: GameLog,
    private readonly timeoutMs: number,
    private readonly onDone: (guesses: Guess[]) => void,
    private readonly now: () => number = Date.now,
  ) {}

  /** Ask everyone, and start the clock. */
  start(): void {
    this.startedAt = this.now();
    this.timer = setTimeout(() => this.finish(), this.timeoutMs);
    for (const person of Object.values(this.room.people)) this.ask(person);
    this.check();
  }

  private ask(person: string): void {
    const alias = this.room.aliasOf(person);
    if (alias === null) return;
    const left = Math.max(0, this.timeoutMs - (this.now() - this.startedAt));
    this.room.sendTo(person, { t: 'guess', seats: this.log.cast.map((c) => c.name), you: alias, timeoutMs: left, sent: this.guesses.has(alias) });
  }

  /** A person who reconnected is asked again (or shown that they have already answered). */
  resend(person: string): void {
    if (!this.done) this.ask(person);
  }

  /** A person's answer. Only real seats count, never their own; a second answer replaces nothing. Returns false if it was not taken. */
  submit(person: string, ai: string[]): boolean {
    const alias = this.room.aliasOf(person);
    if (this.done || alias === null || this.guesses.has(alias)) return false;
    const seats = new Set(this.log.cast.map((c) => c.name));
    this.guesses.set(alias, ai.filter((name) => seats.has(name) && name !== alias));
    this.check();
    return true;
  }

  /** Finish now if everyone who is still connected has answered. Call it when someone answers or goes. */
  check(): void {
    if (this.done) return;
    const waiting = this.room.seats.some((seat) => {
      const alias = this.room.aliasOf(seat.name);
      return alias !== null && seat.conn !== null && !this.guesses.has(alias);
    });
    if (!waiting) this.finish();
  }

  /** The room closed: stop the clock and report nothing. */
  cancel(): void {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private finish(): void {
    if (this.done) return;
    this.cancel();
    this.onDone([...this.guesses].map(([seat, ai]) => ({ seat, ai })));
  }
}
