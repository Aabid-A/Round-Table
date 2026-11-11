// Vocabulary shared by every module.

export type Role = 'traitor' | 'faithful';

export type Phase =
  | 'night'
  | 'whispers'
  | 'round_table'
  | 'vote'
  | 'revote'
  | 'recruit_choose'
  | 'recruit_respond'
  | 'endgame_vote';

export interface CastMember {
  name: string;
  model: string;
}

/** Token counts and cost for one model call, when the provider reports them. */
export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

/** A reported cost counts only if it is a finite, non-negative number. */
export function isUsableCost(cost: unknown): cost is number {
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
}
