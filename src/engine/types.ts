import type { CastMember, Phase, Role, Usage } from '../types.js';

export type EndReason =
  | 'no_traitors'
  | 'no_faithfuls'
  | 'two_remaining'
  | 'endgame_vote'
  | 'max_rounds'
  | 'cost_cap'
  | 'call_limit';

export interface GameSettings {
  maxRounds: number;
  traitors: number;
}

/** What the spend cap counts for a real-model call with no usable cost, until a real cost has been seen in the game (USD). */
export const DEFAULT_COST_FLOOR_USD = 0.01;

export const DEFAULT_SETTINGS: GameSettings = { maxRounds: 6, traitors: 2 };

/** Survivors at or below this count trigger the end-or-banish vote. */
export const ENDGAME_AT = 4;

/** The game ends when this many players or fewer remain. */
export const END_AT_REMAINING = 2;

// ---- Actions (one per phase) ----

export interface NightAction { target: string }
export interface WhisperAction { to: string | null; message: string }
export interface RoundTableAction { suspect: string; reason: string }
export interface VoteAction { target: string }
export interface RecruitChooseAction { target: string | null }
export interface RecruitRespondAction { accept: boolean }
export interface EndgameVoteAction { choice: 'end' | 'banish' }

export type Action =
  | NightAction
  | WhisperAction
  | RoundTableAction
  | VoteAction
  | RecruitChooseAction
  | RecruitRespondAction
  | EndgameVoteAction;

// ---- Turns (log) ----

export interface TurnAttempt {
  /** User prompt sent for this attempt (retries append the error). */
  prompt: string;
  /** Raw reply text, or null if the player threw (then `error` is the thrown message). */
  raw: string | null;
  /** Why this attempt was rejected, or null if it was accepted. */
  error: string | null;
  /** Present and true only when the JSON object was taken from text around it. */
  extracted?: true;
  /** Token counts and cost the provider reported for this attempt, if any. */
  usage?: Usage;
  /**
   * Present when this call was to a real model under a spend cap and no usable cost came back (it timed out, failed, or reported
   * none): the amount the cap counted for it. The largest cost seen so far in the game, or the floor if none had been seen.
   */
  costEstimatedUsd?: number;
}

export interface Turn {
  id: number;
  round: number;
  phase: Phase;
  player: string;
  attempts: TurnAttempt[];
  speech: string;
  private_notes: string;
  action: Action;
  fallback: boolean;
}

// ---- Events (log + visibility) ----

export type Visibility = 'all' | string[];

interface EventBase {
  round: number;
  /** Id of the last turn logged before this event, or -1. */
  afterTurn: number;
  visibleTo: Visibility;
}

export type GameEvent = EventBase &
  (
    | { type: 'murder'; victim: string | null; proposals: { player: string; target: string }[]; method: 'agreed' | 'random' | 'none' }
    | { type: 'breakfast'; victim: string | null; role: Role | null }
    | { type: 'whisper'; from: string; to: string; message: string }
    | { type: 'speech'; player: string; speech: string; suspect: string; reason: string }
    | { type: 'vote'; stage: 'vote' | 'revote'; votes: { voter: string; target: string }[]; tally: Record<string, number>; leaders: string[] }
    | { type: 'banishment'; player: string; role: Role; method: 'majority' | 'revote' | 'random' }
    | { type: 'recruit'; offeredBy: string; offeredTo: string; accepted: boolean }
    | { type: 'endgame_vote'; votes: { voter: string; choice: 'end' | 'banish' }[]; end: boolean }
  );

// ---- State ----

export type PlayerStatus = 'alive' | 'murdered' | 'banished';

export interface PlayerState extends CastMember {
  role: Role;
  status: PlayerStatus;
}

/**
 * Told about the game as it happens, for a server that shows it to people who are not playing. It sees what the log will hold, in
 * the same order, and cannot change the game: an observer that throws is ignored.
 */
export interface GameObserver {
  /** The roles, once drawn, before the first turn. */
  start?(info: { roles: Record<string, Role> }): void;
  turn?(turn: Turn): void;
  event?(event: GameEvent): void;
}

export interface GameState {
  observer?: GameObserver;
  round: number;
  players: PlayerState[];
  events: GameEvent[];
  turns: Turn[];
}

// ---- What one player may see ----

export interface PlayerView {
  player: string;
  role: Role;
  fellowTraitors: string[];
  round: number;
  alive: string[];
  eliminated: { name: string; role: Role; how: 'murdered' | 'banished'; round: number }[];
  events: GameEvent[];
}

// ---- Prompt requests (engine -> prompt builders) ----

interface RequestBase { view: PlayerView; options: string[] }

export type PhaseRequest =
  | (RequestBase & { phase: 'night'; proposals: { player: string; target: string }[] | null })
  | (RequestBase & { phase: 'whispers' })
  | (RequestBase & { phase: 'round_table' })
  | (RequestBase & { phase: 'vote' })
  | (RequestBase & { phase: 'revote'; tied: string[] })
  | (RequestBase & { phase: 'recruit_choose' })
  | (RequestBase & { phase: 'recruit_respond'; offeredBy: string })
  | (RequestBase & { phase: 'endgame_vote' });

// ---- Log ----

export interface GameResult {
  /** Null only when the game was stopped early (`cost_cap` or `call_limit`). */
  winner: Role | null;
  reason: EndReason;
  rounds: number;
  survivors: { name: string; role: Role }[];
  /** Present only when reason is `cost_cap`. */
  costCap?: { maxUsd: number; spentUsd: number };
  /** Present only when reason is `call_limit`: the limit on calls to players, and how many had been made when the game stopped. */
  callLimit?: { maxCalls: number; calls: number };
}

export interface GameLog {
  schemaVersion: 1;
  seed: number;
  settings: GameSettings;
  cast: CastMember[];
  roles: Record<string, Role>;
  systemPrompt: string;
  turns: Turn[];
  events: GameEvent[];
  result: GameResult;
}
