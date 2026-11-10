import type { Phase } from '../types.js';

/** What the engine hands a player for one attempt at one turn. */
export interface PromptRequest {
  system: string;
  user: string;
  /** Hints for scripted players. Real models only read system and user. */
  phase: Phase;
  player: string;
  options: string[];
}

/** Takes a prompt, returns the raw reply text. May throw (timeout, HTTP error). */
export interface Player {
  respond(request: PromptRequest): Promise<string>;
}
