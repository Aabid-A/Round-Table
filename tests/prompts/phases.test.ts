import { describe, expect, it } from 'vitest';
import { createState, viewFor, addEvent, eventBase } from '../../src/engine/state.js';
import type { PhaseRequest } from '../../src/engine/types.js';
import { MOCK_CAST } from '../../src/players/mock.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { buildSystemPrompt, SYSTEM_PROMPT } from '../../src/prompts/system.js';
import type { Role } from '../../src/types.js';

const roles: Record<string, Role> = Object.fromEntries(MOCK_CAST.map((c, i) => [c.name, i < 2 ? 'traitor' : 'faithful']));

function setup() {
  const state = createState(MOCK_CAST, roles);
  state.round = 1;
  addEvent(state, { type: 'whisper', ...eventBase(state, ['Cleo', 'Dax']), from: 'Cleo', to: 'Dax', message: 'SECRET-WHISPER' });
  addEvent(state, { type: 'murder', ...eventBase(state, ['Aria', 'Bram']), victim: 'Hugo', proposals: [], method: 'agreed' });
  addEvent(state, { type: 'breakfast', ...eventBase(state, 'all'), victim: 'Hugo', role: 'faithful' });
  return state;
}

const phases = (state: ReturnType<typeof setup>, p: string): PhaseRequest[] => {
  const view = viewFor(state, p);
  const options = ['Bram', 'Cleo'];
  return [
    { phase: 'night', view, options, proposals: null },
    { phase: 'whispers', view, options },
    { phase: 'round_table', view, options },
    { phase: 'vote', view, options },
    { phase: 'revote', view, options, tied: options },
    { phase: 'recruit_choose', view, options },
    { phase: 'recruit_respond', view, options: [], offeredBy: 'Aria' },
    { phase: 'endgame_vote', view, options: [] },
  ];
};

describe('prompt builders', () => {
  it('give every phase a prompt that names the player, the role and the reply shape', () => {
    const state = setup();
    for (const req of phases(state, 'Dax')) {
      const text = buildPrompt(req);
      expect(text, req.phase).toContain('You are Dax. Your role: faithful.');
      expect(text, req.phase).toContain('Action:');
    }
  });

  it('shows a whisper only to its sender and recipient', () => {
    const state = setup();
    for (const who of ['Cleo', 'Dax']) {
      for (const req of phases(state, who)) expect(buildPrompt(req), `${who} ${req.phase}`).toContain('SECRET-WHISPER');
    }
    for (const who of ['Aria', 'Bram', 'Esme', 'Hugo']) {
      for (const req of phases(state, who)) expect(buildPrompt(req), `${who} ${req.phase}`).not.toContain('SECRET-WHISPER');
    }
  });

  it('shows traitors their partner and hides it from faithfuls', () => {
    const state = setup();
    expect(buildPrompt(phases(state, 'Aria')[0] as PhaseRequest)).toContain('Your fellow traitors: Bram.');
    expect(buildPrompt(phases(state, 'Dax')[0] as PhaseRequest)).not.toContain('fellow traitors');
    expect(buildPrompt(phases(state, 'Dax')[2] as PhaseRequest)).not.toContain('murdered Hugo');
  });

  it('reveals public breakfast results to everyone', () => {
    const state = setup();
    expect(buildPrompt(phases(state, 'Esme')[2] as PhaseRequest)).toContain('Hugo was murdered in the night. They were a faithful.');
  });

  it('system prompt explains the rules and the JSON format', () => {
    expect(SYSTEM_PROMPT).toContain('"private_notes"');
    expect(SYSTEM_PROMPT).toContain('viewers see this, other players never do');
    expect(SYSTEM_PROMPT).toContain('1–3 sentences');
  });
});

describe('buildSystemPrompt', () => {
  it('reflects the game settings', () => {
    const text = buildSystemPrompt({ players: 8, traitors: 3, maxRounds: 4 });
    expect(text).toContain('Three of them are secret TRAITORS');
    expect(text).toContain('after round 4');
    expect(buildSystemPrompt({ players: 8, traitors: 1, maxRounds: 6 })).toContain('One of them is a secret TRAITOR');
  });
});
