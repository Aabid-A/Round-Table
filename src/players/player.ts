import type { Phase, Usage } from '../types.js';

/** What the engine hands a player for one attempt at one turn. */
export interface PromptRequest {
  system: string;
  user: string;
  /** Hints for scripted players. Real models only read system and user. */
  phase: Phase;
  player: string;
  options: string[];
}

/** Raw reply text, or the text plus the provider's usage numbers for the call. */
export type PlayerReply = string | { text: string; usage?: Usage };

/** Takes a prompt, returns the raw reply. May throw (timeout, HTTP error). */
export interface Player {
  respond(request: PromptRequest): Promise<PlayerReply>;
  /**
   * True for a player whose every call costs money (a real model). The spend cap counts such a call even when no cost comes back
   * (a timeout, an error, a reply with no usage), as an estimate. Mock and human players are not metered: their calls are free.
   */
  metered?: boolean;
}
