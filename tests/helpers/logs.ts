import type { Action, GameEvent, GameLog, GameResult, Turn } from '../../src/engine/types.js';
import type { Phase, Role } from '../../src/types.js';

/** A turn, written compactly. */
export interface TurnSpec {
  r: number;
  phase: Phase;
  p: string;
  action: Action;
  speech?: string;
  notes?: string;
  fb?: boolean;
}

/** An event, written compactly: everything except round, afterTurn and visibleTo. */
export interface EventSpec {
  r: number;
  ev: Record<string, unknown> & { type: GameEvent['type'] };
}

export type Spec = TurnSpec | EventSpec;

const isEvent = (s: Spec): s is EventSpec => 'ev' in s;

/** Build a valid schemaVersion 1 log by hand, so a rule can be tested on exactly the moment it should find. */
export function logFrom(
  roles: Record<string, Role>,
  specs: Spec[],
  result: Partial<GameResult> = {},
  models: Record<string, string> = {},
): GameLog {
  const names = Object.keys(roles);
  const turns: Turn[] = [];
  const events: GameEvent[] = [];
  let rounds = 1;
  for (const s of specs) {
    rounds = Math.max(rounds, s.r);
    if (isEvent(s)) {
      events.push({ round: s.r, afterTurn: turns.length - 1, visibleTo: 'all', ...s.ev } as unknown as GameEvent);
    } else {
      turns.push({
        id: turns.length,
        round: s.r,
        phase: s.phase,
        player: s.p,
        attempts: [{ prompt: '', raw: '{}', error: null }],
        speech: s.speech ?? '',
        private_notes: s.notes ?? '',
        action: s.action,
        fallback: s.fb ?? false,
      });
    }
  }
  return {
    schemaVersion: 1,
    seed: 1,
    settings: { maxRounds: 6, traitors: 2 },
    cast: names.map((name) => ({ name, model: models[name] ?? 'mock' })),
    roles,
    systemPrompt: '',
    turns,
    events,
    result: { winner: 'traitor', reason: 'endgame_vote', rounds, survivors: [], ...result },
  };
}
