import type { Player } from '../players/player.js';
import type { Rng } from './rng.js';
import type { Usage } from '../types.js';
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
}

export interface Budget {
  maxUsd: number;
  spentUsd: number;
  /** Largest single-call cost seen so far; used to predict the next call. */
  maxCallUsd: number;
}

/** Thrown before a model call when the next call could pass the cost cap. */
export class CostCapReached extends Error {
  constructor() {
    super('cost cap reached');
  }
}

/** The next call "would pass" the cap if spend so far plus the dearest call yet exceeds it. */
export function wouldPassCap(b: Budget): boolean {
  return b.spentUsd + b.maxCallUsd > b.maxUsd;
}

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
 * is used and logged with fallback: true. Never throws.
 */
export async function takeTurn(ctx: EngineContext, request: PhaseRequest): Promise<Turn> {
  const player = request.view.player;
  const { phase, options } = request;
  const baseUser = ctx.buildPrompt(request);
  const attempts: TurnAttempt[] = [];
  const id = ctx.state.turns.length;
  let user = baseUser;
  let accepted: { speech: string; private_notes: string; action: Action } | null = null;

  for (let i = 0; i < 2 && !accepted; i++) {
    if (ctx.budget && wouldPassCap(ctx.budget)) {
      // Before the first attempt, stop the game. Before the retry, settle this turn with its fallback;
      // the next turn then stops the game.
      if (i === 0) throw new CostCapReached();
      break;
    }
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
    attempts.push({
      prompt: user,
      raw,
      error,
      ...(extracted ? { extracted: true as const } : {}),
      ...(usage ? { usage } : {}),
    });
    if (ctx.budget && usage?.costUsd !== undefined) {
      ctx.budget.spentUsd += usage.costUsd;
      ctx.budget.maxCallUsd = Math.max(ctx.budget.maxCallUsd, usage.costUsd);
    }
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
