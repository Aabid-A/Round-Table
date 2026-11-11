import type { GameLog } from '../src/engine/types.js';
import type { Guess } from '../src/roomResult.js';
import type { Room } from './room.js';

/** How long someone who dropped (a reload, a flicker) has to come back before the step stops waiting for them. */
export const RECONNECT_GRACE_MS = 8_000;

/**
 * After an alias game, before anyone is told who was who: each person says which seats they think were AIs.
 * It waits for every person who is still connected, up to `timeoutMs`; someone who has left, or is too slow, is simply not scored.
 * `onDone` runs once, with the guesses that came in, keyed by the guesser's alias.
 */
export class Guessing {
  private readonly guesses = new Map<string, string[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private done = false;

  constructor(
    private readonly room: Room,
    private readonly log: GameLog,
    private readonly timeoutMs: number,
    private readonly onDone: (guesses: Guess[]) => void,
    private readonly now: () => number = Date.now,
    private readonly graceMs: number = RECONNECT_GRACE_MS,
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

  /**
   * Someone's connection went. Finish if everyone left has answered, but only after a short grace: a person who reloads the page
   * comes straight back, and should not lose their guess because they were the last one.
   */
  connectionLost(): void {
    if (this.done || this.graceTimer) return;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.check();
    }, this.graceMs);
  }

  /** Finish now if everyone who is still connected has answered. Call it when someone answers, or when the start finds nobody here. */
  check(): void {
    if (this.done) return;
    let here = false; // someone connected who has not answered
    let gone = false; // someone not connected who has not answered
    for (const seat of this.room.seats) {
      const alias = this.room.aliasOf(seat.name);
      if (alias === null || this.guesses.has(alias)) continue;
      if (seat.conn !== null) here = true;
      else gone = true;
    }
    // Someone who dropped a moment ago may be reloading: while their grace runs, do not finish without them.
    if (here || (gone && this.graceTimer !== null)) return;
    this.finish();
  }

  /** The room closed: stop the clock and report nothing. */
  cancel(): void {
    this.done = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.timer = null;
    this.graceTimer = null;
  }

  private finish(): void {
    if (this.done) return;
    this.cancel();
    this.onDone([...this.guesses].map(([seat, ai]) => ({ seat, ai })));
  }
}
