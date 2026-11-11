import type { GameEvent, GameLog, Turn } from '../../engine/types.js';

/** Questions about a game that the highlight rules keep asking. All answers come from the log alone. */
export interface Context {
  log: GameLog;
  turnById(id: number): Turn | undefined;
  /** Is the player a traitor when turn `turnId` is played? A recruit counts from the turn after they accept. */
  isTraitorAt(player: string, turnId: number): boolean;
  /** Has the player been murdered or banished before turn `turnId`? */
  isOutAt(player: string, turnId: number): boolean;
  /** Who the traitor proposed to murder in any night up to and including `round`. */
  nightTargets(traitor: string, round: number): Set<string>;
  /** The turns of one voting stage in a round, in order. */
  stageTurns(round: number, phase: 'vote' | 'revote'): Turn[];
  turnsOf(round: number, phase: Turn['phase']): Turn[];
  events<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[];
}

export function buildContext(log: GameLog): Context {
  const byId = new Map(log.turns.map((t) => [t.id, t]));
  const recruits = log.events.filter((e): e is Extract<GameEvent, { type: 'recruit' }> => e.type === 'recruit' && e.accepted);
  const exits = log.events.flatMap((e) =>
    e.type === 'breakfast' && e.victim !== null
      ? [{ player: e.victim, after: e.afterTurn }]
      : e.type === 'banishment'
        ? [{ player: e.player, after: e.afterTurn }]
        : [],
  );
  return {
    log,
    turnById: (id) => byId.get(id),
    isTraitorAt: (player, turnId) =>
      log.roles[player] === 'traitor' || recruits.some((r) => r.offeredTo === player && r.afterTurn < turnId),
    isOutAt: (player, turnId) => exits.some((x) => x.player === player && x.after < turnId),
    nightTargets: (traitor, round) => {
      const out = new Set<string>();
      for (const t of log.turns) {
        if (t.phase === 'night' && t.player === traitor && t.round <= round) out.add((t.action as { target: string }).target);
      }
      return out;
    },
    stageTurns: (round, phase) => log.turns.filter((t) => t.round === round && t.phase === phase),
    turnsOf: (round, phase) => log.turns.filter((t) => t.round === round && t.phase === phase),
    events: <T extends GameEvent['type']>(type: T) => log.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type),
  };
}
