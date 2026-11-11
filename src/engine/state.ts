import type { Role } from '../types.js';
import type { Rng } from './rng.js';
import type { CastMember } from '../types.js';
import type { EndReason, GameEvent, GameState, PlayerState, PlayerView, Visibility } from './types.js';

/** Roles are the first thing drawn from the RNG, so tests can predict them. */
export function assignRoles(names: string[], traitors: number, rng: Rng): Record<string, Role> {
  const shuffled = rng.shuffle(names);
  const roles: Record<string, Role> = {};
  for (const name of names) roles[name] = 'faithful';
  for (const name of shuffled.slice(0, traitors)) roles[name] = 'traitor';
  return roles;
}

export function createState(cast: CastMember[], roles: Record<string, Role>): GameState {
  const players: PlayerState[] = cast.map((c) => ({
    name: c.name,
    model: c.model,
    role: roles[c.name] as Role,
    status: 'alive',
  }));
  return { round: 0, players, events: [], turns: [] };
}

export const alive = (s: GameState): PlayerState[] => s.players.filter((p) => p.status === 'alive');
export const aliveNames = (s: GameState): string[] => alive(s).map((p) => p.name);
export const aliveTraitors = (s: GameState): string[] =>
  alive(s).filter((p) => p.role === 'traitor').map((p) => p.name);
export const aliveFaithfuls = (s: GameState): string[] =>
  alive(s).filter((p) => p.role === 'faithful').map((p) => p.name);

export function getPlayer(s: GameState, name: string): PlayerState {
  const p = s.players.find((x) => x.name === name);
  if (!p) throw new Error(`unknown player ${name}`);
  return p;
}

export function addEvent(s: GameState, event: GameEvent): void {
  s.events.push(event);
}

export function eventBase(s: GameState, visibleTo: Visibility): { round: number; afterTurn: number; visibleTo: Visibility } {
  return { round: s.round, afterTurn: s.turns.length - 1, visibleTo };
}

export function isVisibleTo(event: GameEvent, player: string): boolean {
  return event.visibleTo === 'all' || event.visibleTo.includes(player);
}

/** Everything one player may see. Private notes are not in game state at all. */
export function viewFor(s: GameState, player: string): PlayerView {
  const me = getPlayer(s, player);
  const eliminated = s.players
    .filter((p) => p.status !== 'alive')
    .map((p) => ({ name: p.name, role: p.role, how: p.status as 'murdered' | 'banished', round: 0 }));
  // The round an elimination happened is recorded on its public event.
  for (const e of eliminated) {
    const ev = s.events.find(
      (x) => (x.type === 'breakfast' && x.victim === e.name) || (x.type === 'banishment' && x.player === e.name),
    );
    e.round = ev?.round ?? 0;
  }
  return {
    player,
    // A recruit's role changes from the moment they accept; `role` here is current.
    role: me.role,
    fellowTraitors: me.role === 'traitor' ? aliveTraitors(s).filter((n) => n !== player) : [],
    round: s.round,
    alive: aliveNames(s),
    eliminated,
    events: s.events.filter((e) => isVisibleTo(e, player)),
  };
}

export function checkEnd(s: GameState): EndReason | null {
  const traitors = aliveTraitors(s).length;
  const faithfuls = aliveFaithfuls(s).length;
  if (traitors === 0) return 'no_traitors';
  if (faithfuls === 0) return 'no_faithfuls';
  if (traitors + faithfuls <= 2) return 'two_remaining';
  return null;
}

export function winnerOf(s: GameState): Role {
  return aliveTraitors(s).length > 0 ? 'traitor' : 'faithful';
}
