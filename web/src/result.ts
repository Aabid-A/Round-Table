/** How a finished game is announced. Shared by the solo page and rooms. */
export const WINNER = { traitor: 'The traitors win', faithful: 'The faithfuls win' } as const;

/** Why a game ended. `cost_cap` is left out: whose cap it was depends on the page. */
export const END_REASONS: Record<string, string> = {
  no_traitors: 'No traitors are left.',
  no_faithfuls: 'No faithfuls are left.',
  two_remaining: 'Two players remain.',
  endgame_vote: 'The survivors voted to end the game.',
  max_rounds: 'The last round was played.',
};
