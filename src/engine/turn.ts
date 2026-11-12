import type { Player } from '../players/player.js';
import type { Rng } from './rng.js';
import { isUsableCost, type Usage } from '../types.js';
import type { Action, GameState, PhaseRequest, Turn, TurnAttempt } from './types.js';
import { fallbackAction, parseReply } from './validate.js';

export interface EngineContext {
  state: GameState;
  rng: Rng;
  players: Record<string, Player>;
  buildPrompt: (request: PhaseRequest) => string;
  systemPrompt: string;
  /** Optional spend cap. Updated as attempts report their cost. */
  budget?: Budget;
  /** Hard limit on calls to players, whatever they cost. `made` goes up with every attempt. */
  calls?: { max: number; made: number };
}

export interface Budget {
  maxUsd: number;
  spentUsd: number;
  /** Largest single-call cost seen so far (a floor counts too, once it has been used); used to predict the next call. */
  maxCallUsd: number;
  /** What a real-model call with no usable cost counts for until a real cost has been seen. */
  floorUsd: number;
}

/** Thrown before a call to a player when the game has already made as many as it is allowed. */
export class CallLimitReached extends Error {
  constructor() {
    super('call limit reached');
  }
}

/** Attempts a turn gets: the first, and one retry with the error included. */
export const MAX_ATTEMPTS = 2;

/** Thrown before a model call when the next call could pass the cost cap. */
export class CostCapReached extends Error {
  constructor() {
    super('cost cap reached');
  }
}

/** Float sums like 0.1 + 0.1 + 0.1 land a hair over 0.3; ignore differences below a billionth of a dollar. */
const CAP_EPSILON = 1e-9;

/**
 * The next call "would pass" the cap if spend so far plus the dearest call yet exceeds it.
 * It is a prediction, not a hard ceiling: the first call, or a call dearer than any before it, can overshoot.
 */
export function wouldPassCap(b: Budget): boolean {
  return b.spentUsd + b.maxCallUsd > b.maxUsd + CAP_EPSILON;
}

export const roundUsd = (n: number): number => Math.round(n * 1e9) / 1e9;

const MAX_ERROR_LENGTH = 200;

function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.slice(0, MAX_ERROR_LENGTH);
}

function retryNote(raw: string | null, error: string): string {
  const what = raw === null ? 'Your previous request failed' : 'Your previous reply was invalid';
  return `\n\n${what}: ${error}.\nReply again with a single valid JSON object in the required format.`;
}

/**
 * Ask one player for one turn. An invalid reply (or a thrown player error) gets
 * exactly one retry with the error included; after that a deterministic fallback
 * is used and logged with fallback: true. Never throws for a bad reply or a player error; the only
 * exception is CostCapReached, which stops the whole game.
 */
export async function takeTurn(ctx: EngineContext, request: PhaseRequest): Promise<Turn> {
  const player = request.view.player;
  const { phase, options } = request;
  const baseUser = ctx.buildPrompt(request);
  const attempts: TurnAttempt[] = [];
  const id = ctx.state.turns.length;
  let user = baseUser;
  const metered = ctx.players[player]?.metered === true;
  let accepted: { speech: string; private_notes: string; action: Action } | null = null;

  for (let i = 0; i < MAX_ATTEMPTS && !accepted; i++) {
    // The hard limit on calls comes first and does not depend on cost. Before the first attempt it stops the game; before the
    // retry the turn is settled with its fallback, and the next turn stops the game (as with the cost cap).
    if (ctx.calls && ctx.calls.made >= ctx.calls.max) {
      if (i === 0) throw new CallLimitReached();
      break;
    }
    if (ctx.budget && wouldPassCap(ctx.budget)) {
      // Before the first attempt, stop the game. Before the retry, settle this turn with its fallback;
      // the next turn then stops the game.
      if (i === 0) throw new CostCapReached();
      break;
    }
    if (ctx.calls) ctx.calls.made++;
    let raw: string | null = null;
    let error: string | null = null;
    let extracted = false;
    let usage: Usage | undefined;
    try {
      const impl = ctx.players[player];
      if (!impl) throw new Error(`no player implementation for ${player}`);
      const reply = await impl.respond({ system: ctx.systemPrompt, user, phase, player, options });
      if (typeof reply === 'string') raw = reply;
      else if (reply && typeof reply.text === 'string') {
        raw = reply.text;
        usage = reply.usage;
      } else throw new Error('player returned a non-string reply');
      const parsed = parseReply(phase, raw, options);
      if (parsed.ok) {
        accepted = parsed.reply;
        extracted = parsed.extracted;
      }
      else error = parsed.error;
    } catch (e) {
      error = errorMessage(e);
    }
    // A cost that is not a finite, non-negative number would corrupt the total (NaN never caps, negative refunds).
    let estimate: number | undefined;
    if (ctx.budget && isUsableCost(usage?.costUsd)) {
      ctx.budget.spentUsd += usage.costUsd;
      ctx.budget.maxCallUsd = Math.max(ctx.budget.maxCallUsd, usage.costUsd);
    } else if (ctx.budget && metered) {
      // A real model was called and no cost came back (a timeout, an error, no usage in the reply). It may still have been billed,
      // so count the largest cost seen so far, or the floor if none yet, and say in the log that it was an estimate.
      estimate = ctx.budget.maxCallUsd > 0 ? ctx.budget.maxCallUsd : ctx.budget.floorUsd;
      ctx.budget.spentUsd += estimate;
      ctx.budget.maxCallUsd = Math.max(ctx.budget.maxCallUsd, estimate);
    }
    attempts.push({
      prompt: user,
      raw,
      error,
      ...(extracted ? { extracted: true as const } : {}),
      ...(usage ? { usage } : {}),
      ...(estimate !== undefined ? { costEstimatedUsd: estimate } : {}),
    });
    if (error !== null) user = baseUser + retryNote(raw, error);
  }

  const turn: Turn = {
    id,
    round: ctx.state.round,
    phase,
    player,
    attempts,
    speech: accepted?.speech ?? '',
    private_notes: accepted?.private_notes ?? '',
    action: accepted?.action ?? fallbackAction(phase, options, id),
    fallback: accepted === null,
  };
  ctx.state.turns.push(turn);
  return turn;
}
