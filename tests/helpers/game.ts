import { runGame } from '../../src/engine/game.js';
import { createRng } from '../../src/engine/rng.js';
import { assignRoles } from '../../src/engine/state.js';
import { DEFAULT_SETTINGS, type GameLog, type GameSettings } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import type { Player, PromptRequest } from '../../src/players/player.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';
import type { Role } from '../../src/types.js';

export const names = MOCK_CAST.map((c) => c.name);

export function play(
  players: Record<string, Player>,
  seed: number,
  settings: Partial<GameSettings> = {},
): Promise<GameLog> {
  return runGame({
    cast: MOCK_CAST,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    seed,
    players,
    buildPrompt,
    systemPrompt: SYSTEM_PROMPT,
  });
}

export const playMock = (seed: number, settings: Partial<GameSettings> = {}): Promise<GameLog> =>
  play(createMockPlayers(MOCK_CAST, seed), seed, settings);

export const rolesFor = (seed: number): Record<string, Role> =>
  assignRoles(names, DEFAULT_SETTINGS.traitors, createRng(seed));

export const reply = (action: unknown, speech = '', notes = 'note'): string =>
  JSON.stringify({ speech, private_notes: notes, action });

export type Script = (req: PromptRequest) => string | undefined;

/** Players that follow `script`, falling back to the first valid option. */
export function scripted(script: Script): Record<string, Player> {
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        async respond(req: PromptRequest): Promise<string> {
          return script(req) ?? defaultReply(req);
        },
      } satisfies Player,
    ]),
  );
}

export function defaultReply(req: PromptRequest): string {
  const first = req.options[0] as string;
  switch (req.phase) {
    case 'night':
    case 'vote':
    case 'revote':
      return reply({ target: first });
    case 'round_table':
      return reply({ suspect: first, reason: 'because' }, 'I speak.');
    case 'whispers':
      return reply({ to: null });
    case 'recruit_choose':
      return reply({ target: null });
    case 'recruit_respond':
      return reply({ accept: false });
    case 'endgame_vote':
      return reply({ choice: 'banish' });
  }
}
