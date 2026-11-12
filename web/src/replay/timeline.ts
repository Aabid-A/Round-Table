import type { GameEvent, GameLog, Turn } from '../../../src/engine/types.js';
import type { Role } from '../../../src/types.js';

export interface Section {
  round: number;
  title: string;
}

export type Step =
  | { kind: 'turn'; turn: Turn; section: Section }
  | { kind: 'event'; event: GameEvent; section: Section }
  | { kind: 'result'; section: Section };

const TURN_TITLES: Record<Turn['phase'], string> = {
  night: 'Night',
  whispers: 'Whispers',
  round_table: 'Round table',
  vote: 'Banishment vote',
  revote: 'Revote',
  recruit_choose: 'Recruitment',
  recruit_respond: 'Recruitment',
  endgame_vote: 'End-or-banish vote',
};

const EVENT_TITLES: Partial<Record<GameEvent['type'], string>> = {
  murder: 'Night',
  breakfast: 'Breakfast',
  vote: 'Banishment vote',
  banishment: 'Banishment',
  recruit: 'Recruitment',
  endgame_vote: 'End-or-banish vote',
};

/** Speech and whisper events repeat what their turn already shows. */
const isShownByTurn = (e: GameEvent): boolean => e.type === 'speech' || e.type === 'whisper';

/** Turns and events in the order they happened, then a result step. Arrow keys walk this list. */
export function buildSteps(log: GameLog, opts: { partial?: boolean } = {}): Step[] {
  const steps: Step[] = [];
  const pushEvents = (afterTurn: number): void => {
    for (const event of log.events) {
      if (event.afterTurn !== afterTurn || isShownByTurn(event)) continue;
      const title = event.type === 'vote' && event.stage === 'revote' ? 'Revote' : (EVENT_TITLES[event.type] ?? 'Game');
      steps.push({ kind: 'event', event, section: { round: event.round, title } });
    }
  };
  pushEvents(-1);
  for (const turn of log.turns) {
    steps.push({ kind: 'turn', turn, section: { round: turn.round, title: TURN_TITLES[turn.phase] } });
    pushEvents(turn.id);
  }
  // A game that is still going has no result to show yet.
  if (!opts.partial) steps.push({ kind: 'result', section: { round: log.result.rounds, title: 'Result' } });
  return steps;
}

export type SeatStatus = 'alive' | 'murdered' | 'banished';

export interface Seat {
  name: string;
  model: string;
  status: SeatStatus;
  /** The role, once the game has publicly revealed it (or at the result). */
  revealedRole: Role | null;
}

/** Roles at the end: the starting roles, plus anyone who accepted a recruitment. */
export function finalRoles(log: GameLog): Record<string, Role> {
  const roles = { ...log.roles };
  for (const e of log.events) if (e.type === 'recruit' && e.accepted) roles[e.offeredTo] = 'traitor';
  return roles;
}

/** Who is still at the table, and which roles are public, after the step at `index` has played. */
export function seatsAt(log: GameLog, steps: Step[], index: number): Seat[] {
  const seats: Seat[] = log.cast.map((c) => ({ name: c.name, model: c.model, status: 'alive', revealedRole: null }));
  const byName = new Map(seats.map((s) => [s.name, s]));
  const roles = finalRoles(log);
  for (let i = 0; i <= index && i < steps.length; i++) {
    const step = steps[i] as Step;
    if (step.kind === 'result') {
      for (const s of seats) s.revealedRole = roles[s.name] ?? null;
    } else if (step.kind === 'event') {
      const e = step.event;
      if (e.type === 'breakfast' && e.victim !== null) {
        const s = byName.get(e.victim);
        if (s) Object.assign(s, { status: 'murdered', revealedRole: e.role });
      } else if (e.type === 'banishment') {
        const s = byName.get(e.player);
        if (s) Object.assign(s, { status: 'banished', revealedRole: e.role });
      }
    }
  }
  return seats;
}
