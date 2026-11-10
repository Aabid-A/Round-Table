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
