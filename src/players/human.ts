import type { Phase } from '../types.js';
import type { Player, PromptRequest } from './player.js';

/** What the person filled in for one turn. */
export interface HumanAnswer {
  /** Said out loud (the round table needs it; other phases ignore it). */
  speech: string;
  /** The person's private note for viewers. Never shown to the AIs. */
  note: string;
  /** The picked option, or null for "none" where a phase allows it. */
  choice: string | null;
  /** A whisper's message, or the reason for a suspect. */
  message: string;
}

export const emptyAnswer = (): HumanAnswer => ({ speech: '', note: '', choice: null, message: '' });

/** The reply the engine reads: the same JSON a model would send. */
export function buildHumanReply(phase: Phase, a: HumanAnswer): string {
  const act = (action: unknown): string => JSON.stringify({ speech: phase === 'round_table' ? a.speech : '', private_notes: a.note, action });
  switch (phase) {
    case 'night':
    case 'vote':
    case 'revote':
      return act({ target: a.choice });
    case 'round_table':
      return act({ suspect: a.choice, reason: a.message });
    case 'whispers':
      return act(a.choice === null ? { to: null } : { to: a.choice, message: a.message });
    case 'recruit_choose':
      return act({ target: a.choice });
    case 'recruit_respond':
      return act({ accept: a.choice === 'accept' });
    case 'endgame_vote':
      return act({ choice: a.choice });
  }
}

/** A Player whose answers come from a person, through `ask` (a form on the page). */
export function createHumanPlayer(ask: (req: PromptRequest) => Promise<HumanAnswer>): Player {
  return {
    async respond(req: PromptRequest): Promise<string> {
      return buildHumanReply(req.phase, await ask(req));
    },
  };
}
