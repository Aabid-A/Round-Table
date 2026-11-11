export type RuleId =
  | 'recruit_accepted'
  | 'traitor_votes_traitor'
  | 'faithful_banished_by_majority'
  | 'whispers_to_night_target'
  | 'defends_night_target'
  | 'saves_night_target_in_revote'
  | 'notes_contradict_praise'
  | 'final_reveal';

export interface Highlight {
  rule: RuleId;
  /** 0 to 100. Higher is better. */
  score: number;
  /** One line a person can read. */
  title: string;
  /** The turn ids of the clip, inclusive. */
  from: number;
  to: number;
  /** A turn that suits the "two faces" shot, when the moment is about speech vs notes. */
  facesTurn: number | null;
  round: number;
}

export interface RankedHighlight extends Highlight {
  rank: number;
  /** Recording-mode URL for the clip. */
  url: string;
  /** Recording-mode URL for the two-faces shot, if the highlight has one. */
  facesUrl: string | null;
}
