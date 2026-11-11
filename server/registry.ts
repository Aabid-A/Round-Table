import { randomInt } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH, LIMITS, type AiSetup } from './protocol.js';
import { Room, type Result } from './room.js';

export interface RegistryOptions {
  /** Injectable for tests. */
  now?: () => number;
  makeCode?: () => string;
  /** Open rooms one address may have. */
  maxRoomsPerOwner?: number;
}

const randomCode = (): string => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

/** Every live room on this server, by code. Rooms live in memory only: a restart ends them. */
export class Registry {
  private readonly rooms = new Map<string, Room>();
  /** When each lobby was first seen with nobody connected. */
  private readonly emptySince = new Map<string, number>();
  private readonly now: () => number;
  private readonly makeCode: () => string;
  private readonly maxRoomsPerOwner: number;

  constructor(opts: RegistryOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.makeCode = opts.makeCode ?? randomCode;
    this.maxRoomsPerOwner = opts.maxRoomsPerOwner ?? LIMITS.roomsPerOwner;
  }

  get size(): number {
    return this.rooms.size;
  }

  create(setup: AiSetup, seed?: number, owner: string | null = null): Result<Room> {
    this.sweep();
    if (this.rooms.size >= LIMITS.rooms) return { ok: false, error: 'This server is full. Try again in a while.' };
    if (owner !== null) {
      const open = [...this.rooms.values()].filter((r) => r.owner === owner && r.phase !== 'finished').length;
      if (open >= this.maxRoomsPerOwner) return { ok: false, error: `You already have ${this.maxRoomsPerOwner} rooms open. Finish or leave one first.` };
    }
    let code = this.makeCode();
    for (let tries = 0; this.rooms.has(code); tries++) {
      if (tries >= 20) return { ok: false, error: 'Could not make a room code. Try again.' };
      code = this.makeCode();
    }
    const room = new Room(code, setup, seed ?? randomInt(2 ** 31), this.now());
    room.owner = owner;
    this.rooms.set(code, room);
    return { ok: true, value: room };
  }

  /** The live room with this code. A room that closed (everyone left, or the game failed) is forgotten here. */
  get(code: string): Room | undefined {
    const room = this.rooms.get(code);
    if (room?.phase === 'closed') {
      this.rooms.delete(code);
      return undefined;
    }
    return room;
  }

  /** Remove rooms that closed, rooms older than the room lifetime, rooms that finished a while ago, and lobbies nobody is in. Returns how many were removed. */
  sweep(): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      const now = this.now();
      const old = now - room.createdAt >= LIMITS.roomTtlMs;
      const doneLongAgo = room.finishedAt !== null && now - room.finishedAt >= LIMITS.finishedTtlMs;
      const empty = room.phase === 'lobby' && room.seats.every((seat) => seat.conn === null);
      if (!empty) this.emptySince.delete(code);
      else if (!this.emptySince.has(code)) this.emptySince.set(code, now);
      const abandoned = empty && now - (this.emptySince.get(code) ?? now) >= LIMITS.emptyLobbyMs;
      if (room.phase !== 'closed' && !old && !doneLongAgo && !abandoned) continue;
      this.emptySince.delete(code);
      room.close(abandoned ? 'This room was left empty.' : 'This room expired.'); // does nothing for a room that already closed
      this.rooms.delete(code);
      removed++;
    }
    return removed;
  }

  closeAll(reason: string): void {
    for (const room of this.rooms.values()) room.close(reason);
    this.rooms.clear();
  }
}
