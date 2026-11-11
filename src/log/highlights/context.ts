import type { GameEvent, GameLog, Turn } from '../../engine/types.js';

/** Questions about a game that the highlight rules keep asking. All answers come from the log alone. */
export interface Context {
  log: GameLog;
  turnById(id: number): Turn | undefined;
  /** Is the player a traitor when turn `turnId` is played? A recruit counts from the turn after they accept. */
  isTraitorAt(player: string, turnId: number): boolean;
  /** Has the player been murdered or banished before turn `turnId`? */
  isOutAt(player: string, turnId: number): boolean;
  /**
   * Who the traitor finally proposed to murder in each night up to and including `round`:
   * player -> the latest round it happened. A first-pass proposal that the traitor
   * replaced in the second pass does not count.
   */
  nightTargets(traitor: string, round: number): Map<string, number>;
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
      const lastPerRound = new Map<number, string>();
      for (const t of log.turns) {
        if (t.phase === 'night' && t.player === traitor && t.round <= round) lastPerRound.set(t.round, (t.action as { target: string }).target);
      }
      const out = new Map<string, number>();
      for (const [r, target] of [...lastPerRound].sort((a, b) => a[0] - b[0])) out.set(target, r);
      return out;
    },
    stageTurns: (round, phase) => log.turns.filter((t) => t.round === round && t.phase === phase),
    turnsOf: (round, phase) => log.turns.filter((t) => t.round === round && t.phase === phase),
    events: <T extends GameEvent['type']>(type: T) => log.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type),
  };
}
