import type { Player } from '../players/player.js';
import type { CastMember } from '../types.js';
import { createRng } from './rng.js';
import { assignRoles, aliveNames, checkEnd, createState, getPlayer, notify, winnerOf } from './state.js';
import { maxModelCalls } from './limits.js';
import { CallLimitReached, CostCapReached, roundUsd, type EngineContext } from './turn.js';
import {
  runBanishment,
  runBreakfast,
  runEndgameVote,
  runNight,
  runRecruitment,
  runRoundTable,
  runWhispers,
} from './phases.js';
import { DEFAULT_COST_FLOOR_USD, ENDGAME_AT, type EndReason, type GameLog, type GameObserver, type GameSettings, type PhaseRequest } from './types.js';

export interface RunGameInput {
  cast: CastMember[];
  settings: GameSettings;
  seed: number;
  players: Record<string, Player>;
  buildPrompt: (request: PhaseRequest) => string;
  systemPrompt: string;
  /** Stop the game cleanly before a call that could pass this many USD in total. */
  maxCostUsd?: number;
  /**
   * With a spend cap: what a real-model call with no usable cost counts for until a real cost has been seen in the game (USD).
   * After that it counts the largest cost seen so far. Default 0.01.
   */
  costFloorUsd?: number;
  /**
   * Hard limit on calls to players in the whole game, whatever they cost. Default: the most a game can need for these seats and
   * rounds (see maxModelCalls), which a normal game never reaches. Lower it only to test, or to be stricter.
   */
  maxModelCalls?: number;
  /** Told about each turn and event as it is logged. It cannot change the game. */
  observer?: GameObserver;
}

/**
 * Run one full game. Deterministic: the same seed and the same raw replies
 * produce an identical log. No I/O happens here except through the players.
 */
export async function runGame(input: RunGameInput): Promise<GameLog> {
  const { cast, settings, seed } = input;
  if (new Set(cast.map((c) => c.name)).size !== cast.length) throw new Error('cast names must be unique');
  if (!Number.isInteger(settings.maxRounds) || settings.maxRounds < 1) throw new Error('maxRounds must be an integer >= 1');
  if (!Number.isInteger(settings.traitors) || settings.traitors < 1 || settings.traitors >= cast.length) throw new Error('traitors must be between 1 and players - 1');

  if (input.maxCostUsd !== undefined && !(Number.isFinite(input.maxCostUsd) && input.maxCostUsd > 0)) {
    throw new Error('maxCostUsd must be a positive number');
  }
  if (input.maxModelCalls !== undefined && !(Number.isInteger(input.maxModelCalls) && input.maxModelCalls > 0)) {
    throw new Error('maxModelCalls must be a positive whole number');
  }
  if (input.costFloorUsd !== undefined && !(Number.isFinite(input.costFloorUsd) && input.costFloorUsd > 0)) {
    throw new Error('costFloorUsd must be a positive number');
  }
  const rng = createRng(seed);
  const roles = assignRoles(cast.map((c) => c.name), settings.traitors, rng);
  const state = createState(cast, roles);
  if (input.observer) state.observer = input.observer;
  notify(state, (o) => o.start?.({ roles: { ...roles } }));
  const ctx: EngineContext = {
    state,
    rng,
    players: input.players,
    buildPrompt: input.buildPrompt,
    systemPrompt: input.systemPrompt,
    calls: { max: input.maxModelCalls ?? maxModelCalls(settings, cast.length), made: 0 },
    ...(input.maxCostUsd !== undefined ? { budget: { maxUsd: input.maxCostUsd, spentUsd: 0, maxCallUsd: 0, floorUsd: input.costFloorUsd ?? DEFAULT_COST_FLOOR_USD } } : {}),
  };

  let reason: EndReason | null = null;
  try {
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
  } catch (e) {
    if (e instanceof CostCapReached) reason = 'cost_cap';
    else if (e instanceof CallLimitReached) reason = 'call_limit';
    else throw e;
  }

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
      winner: reason === 'cost_cap' || reason === 'call_limit' ? null : winnerOf(state),
      reason,
      rounds: state.round,
      survivors: aliveNames(state).map((name) => ({ name, role: getPlayer(state, name).role })),
      ...(reason === 'call_limit' && ctx.calls ? { callLimit: { maxCalls: ctx.calls.max, calls: ctx.calls.made } } : {}),
      ...(reason === 'cost_cap' && ctx.budget ? { costCap: { maxUsd: ctx.budget.maxUsd, spentUsd: roundUsd(ctx.budget.spentUsd) } } : {}),
    },
  };
}
