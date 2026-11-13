import type { GameEvent, GameSettings, Turn, TurnAttempt } from '../src/engine/types.js';
import type { CastMember, Role } from '../src/types.js';
import type { GhostSeat, SpectatorLog } from './protocol.js';

export interface WatchingMeta {
  cast: CastMember[];
  settings: GameSettings;
  seed: number;
  systemPrompt: string;
  /** In an alias game the models would tell people from AIs, so they are blank until the game is over. */
  hideModels: boolean;
}

/**
 * What a room knows about its game as it happens, for the two kinds of watcher: a ghost (a person who is out) sees what each seat
 * was last told, and a spectator sees the game so far, one full round behind. It only keeps and shapes data; the room decides who
 * receives it, and a living player's connection is never one of them.
 */
export class Watching {
  private readonly turns: Turn[] = [];
  private readonly events: GameEvent[] = [];
  private roles: Record<string, Role> | null = null;
  /** The newest round that any turn or event has reached. */
  private round = 0;
  private readonly prompts = new Map<string, string>();
  private readonly gone = new Map<string, 'murdered' | 'banished'>();

  constructor(private readonly meta: WatchingMeta) {}

  start(roles: Record<string, Role>): void {
    this.roles = { ...roles };
  }

  turn(t: Turn): void {
    this.turns.push(t);
    this.round = Math.max(this.round, t.round);
  }

  /** Returns the seat that left the table because of this event, if one did. */
  event(e: GameEvent): { name: string; how: 'murdered' | 'banished' } | null {
    this.events.push(e);
    this.round = Math.max(this.round, e.round);
    if (e.type === 'breakfast' && e.victim !== null) return this.leave(e.victim, 'murdered');
    if (e.type === 'banishment') return this.leave(e.player, 'banished');
    return null;
  }

  private leave(name: string, how: 'murdered' | 'banished'): { name: string; how: 'murdered' | 'banished' } {
    this.gone.set(name, how);
    return { name, how };
  }

  /** The prompt a seat has just been sent: its whole view of the game. */
  prompt(seat: string, user: string): void {
    this.prompts.set(seat, user);
  }

  isOut(seat: string): boolean {
    return this.gone.has(seat);
  }

  /** The round being played now. */
  get liveRound(): number {
    return this.round;
  }

  /** The newest round a spectator may see: the one before the round being played. */
  get visibleRound(): number {
    return Math.max(0, this.round - 1);
  }

  /**
   * The game up to the last full round, or null before the game has started. Nothing in it is newer than that round: not the seed
   * (it decides every role, and in an alias room who is human), and not the roles until a full round is over. In an alias room it
   * also carries nothing that tells a person from a model (see `plain`).
   */
  spectatorLog(): SpectatorLog | null {
    if (this.roles === null) return null;
    const upTo = this.visibleRound;
    const hide = this.meta.hideModels;
    return {
      schemaVersion: 1,
      seed: 0,
      settings: this.meta.settings,
      cast: this.meta.cast.map((c) => ({ name: c.name, model: hide ? '' : c.model })),
      roles: upTo >= 1 ? this.roles : {},
      systemPrompt: this.meta.systemPrompt,
      turns: this.turns.filter((t) => t.round <= upTo).map((t) => (hide ? plain(t) : t)),
      events: this.events.filter((e) => e.round <= upTo),
      result: null,
    };
  }

  /** Every seat as it is now: what it was last told, and whether it is still at the table. */
  ghostSeats(): GhostSeat[] {
    return this.meta.cast.map((c) => ({ name: c.name, status: this.gone.get(c.name) ?? 'alive', prompt: this.prompts.get(c.name) ?? null }));
  }
}

/**
 * A turn with only what the replay draws, for an alias game before the end. A model's turn carries token counts and costs, a
 * person's does not, a person who ran out of time has an error and a fallback, and a person's reply is not a model's: any of
 * that would tell people from AIs before anyone has guessed. The prompt, speech, notes and action stay.
 */
function plain(t: Turn): Turn {
  const first = t.attempts[0];
  const attempt: TurnAttempt = { prompt: first?.prompt ?? '', raw: '', error: null };
  return { ...t, attempts: [attempt], fallback: false };
}
