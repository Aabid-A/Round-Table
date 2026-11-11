import type { Phase } from './types.js';

/**
 * What everyone at a room's table may be told about the phase. The two recruit phases share one label, because an offer is
 * only made when a traitor chose someone, and that is secret between the two of them.
 */
export type PublicPhase = 'night' | 'whispers' | 'round_table' | 'vote' | 'revote' | 'recruit' | 'endgame_vote';

export const publicPhase = (phase: Phase): PublicPhase => (phase === 'recruit_choose' || phase === 'recruit_respond' ? 'recruit' : phase);
