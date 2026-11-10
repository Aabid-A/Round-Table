import type { Player } from '../players/player.js';
import type { CastMember } from '../types.js';
import { createRng } from './rng.js';
import { assignRoles, aliveNames, checkEnd, createState, getPlayer, winnerOf } from './state.js';
import type { EngineContext } from './turn.js';
import {
  runBanishment,
  runBreakfast,
  runEndgameVote,
  runNight,
  runRecruitment,
  runRoundTable,
  runWhispers,
} from './phases.js';
import { ENDGAME_AT, type EndReason, type GameLog, type GameSettings, type PhaseRequest } from './types.js';

export interface RunGameInput {
  cast: CastMember[];
  settings: GameSettings;
  seed: number;
  players: Record<string, Player>;
  buildPrompt: (request: PhaseRequest) => string;
  systemPrompt: string;
}

/**
 * Run one full game. Deterministic: the same seed and the same raw replies
 * produce an identical log. No I/O happens here except through the players.
 */
export async function runGame(input: RunGameInput): Promise<GameLog> {
  const { cast, settings, seed } = input;
  if (new Set(cast.map((c) => c.name)).size !== cast.length) throw new Error('cast names must be unique');
  if (settings.traitors < 1 || settings.traitors >= cast.length) throw new Error('traitors must be between 1 and players - 1');

  const rng = createRng(seed);
  const roles = assignRoles(cast.map((c) => c.name), settings.traitors, rng);
  const state = createState(cast, roles);
  const ctx: EngineContext = {
    state,
    rng,
    players: input.players,
    buildPrompt: input.buildPrompt,
    systemPrompt: input.systemPrompt,
  };

  let reason: EndReason | null = null;
  for (let round = 1; round <= settings.maxRounds && reason === null; round++) {
    state.round = round;
    const victim = await runNight(ctx);
    runBreakfast(ctx, victim);
    reason = checkEnd(state);
    if (reason) break;

    await runWhispers(ctx);
    await runRoundTable(ctx);
    const banished = await runBanishment(ctx);
    await runRecruitment(ctx, banished);
    reason = checkEnd(state);
    if (reason) break;

    if (aliveNames(state).length <= ENDGAME_AT && (await runEndgameVote(ctx))) reason = 'endgame_vote';
  }
  reason ??= 'max_rounds';

  return {
    schemaVersion: 1,
    seed,
    settings,
    cast,
    roles,
    systemPrompt: input.systemPrompt,
    turns: state.turns,
    events: state.events,
    result: {
      winner: winnerOf(state),
      reason,
      rounds: state.round,
      survivors: aliveNames(state).map((name) => ({ name, role: getPlayer(state, name).role })),
    },
  };
}
