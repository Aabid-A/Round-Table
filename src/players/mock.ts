import { createRng, type Rng } from '../engine/rng.js';
import type { CastMember } from '../types.js';
import type { Player, PromptRequest } from './player.js';

export const MOCK_CAST: CastMember[] = ['Aria', 'Bram', 'Cleo', 'Dax', 'Esme', 'Finn', 'Gwen', 'Hugo'].map((name) => ({
  name,
  model: 'mock',
}));

export type MockMode = 'valid' | 'broken';

const SPEECHES = [
  'I have been watching how people vote, and something does not add up.',
  'Let us not rush. Who has stayed quiet when it mattered?',
  'I would rather be careful than sorry. Pay attention to who changes their story.',
  'I trust my read on this table. One of us is not who they claim.',
  'Last night changed things. We need to look at who benefits.',
  'I will be honest: I do not know yet, but I have a feeling.',
];
const REASONS = [
  'they dodged a direct question',
  'their vote did not match their words',
  'they are too eager to point elsewhere',
  'they have been unusually calm',
  'it is a gut feeling, nothing more',
];
const WHISPERS = ['Can we work together?', 'I think we should watch the same person.', 'Tell me who you trust.'];
const PLANS = [
  'Blend in and steer suspicion away from me.',
  'Build trust with one ally and test their reaction.',
  'Push the group toward the quietest player.',
  'Keep my head down and let others argue.',
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function validReply(rng: Rng, req: PromptRequest, note: string, whisperId: string): unknown {
  const pick = (): string => rng.pick(req.options);
  const wrap = (speech: string, action: unknown): unknown => ({ speech, private_notes: note, action });
  switch (req.phase) {
    case 'night':
    case 'vote':
    case 'revote':
      return wrap('', { target: pick() });
    case 'round_table':
      return wrap(rng.pick(SPEECHES), { suspect: pick(), reason: rng.pick(REASONS) });
    case 'whispers':
      return rng.next() < 0.5
        ? wrap('', { to: null })
        : wrap('', { to: pick(), message: `${rng.pick(WHISPERS)} (${whisperId})` });
    case 'recruit_choose':
      return wrap('', { target: rng.next() < 0.2 ? null : pick() });
    case 'recruit_respond':
      return wrap('', { accept: rng.next() < 0.5 });
    case 'endgame_vote':
      return wrap('', { choice: rng.next() < 0.4 ? 'end' : 'banish' });
  }
}

/**
 * Seeded mock player. 'valid' gives varied valid replies with unique private
 * notes (handy for leak checks). 'broken' always returns text that is not valid
 * JSON, to exercise retry and fallback.
 */
export function createMockPlayer(opts: { seed: number; name: string; mode?: MockMode }): Player {
  const rng = createRng(opts.seed ^ hash(opts.name));
  let calls = 0;
  return {
    async respond(req: PromptRequest): Promise<string> {
      calls++;
      if (opts.mode === 'broken') return 'I will not answer in JSON.';
      const tag = `${opts.name}-${String(calls).padStart(4, '0')}`;
      const note = `MOCKNOTE-${tag}: ${rng.pick(PLANS)}`;
      return JSON.stringify(validReply(rng, req, note, `WHISPER-${tag}`));
    },
  };
}

export function createMockPlayers(cast: CastMember[], seed: number): Record<string, Player> {
  return Object.fromEntries(cast.map((c) => [c.name, createMockPlayer({ seed, name: c.name })]));
}
