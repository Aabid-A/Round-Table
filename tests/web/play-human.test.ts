import { describe, expect, it } from 'vitest';
import { parseReply } from '../../src/engine/validate.js';
import type { Phase } from '../../src/types.js';
import { buildHumanReply, createHumanPlayer, emptyAnswer, formFor, isComplete, splitPrompt, type HumanAnswer } from '../../web/src/play/human.js';

const options = ['Bram', 'Cleo'];
const PHASES: Phase[] = ['night', 'whispers', 'round_table', 'vote', 'revote', 'recruit_choose', 'recruit_respond', 'endgame_vote'];
const optionsFor = (p: Phase): string[] => (p === 'recruit_respond' || p === 'endgame_vote' ? [] : options);

/** A filled-in answer for each phase, as a person would submit it. */
const answerFor = (p: Phase): HumanAnswer => {
  const spec = formFor(p, optionsFor(p));
  return { speech: spec.speechLabel ? 'I speak.' : '', note: 'my private note', choice: spec.choices[0]!.value, message: spec.messageLabel ? 'because' : '' };
};

describe('buildHumanReply', () => {
  it('gives a reply the engine accepts for every phase', () => {
    for (const p of PHASES) {
      const raw = buildHumanReply(p, answerFor(p));
      const r = parseReply(p, raw, optionsFor(p));
      expect(r, p).toMatchObject({ ok: true, reply: { private_notes: 'my private note' } });
    }
  });

  it('keeps speech for the round table only', () => {
    const a = { ...answerFor('vote'), speech: 'ignored' };
    expect(JSON.parse(buildHumanReply('vote', a)).speech).toBe('');
    expect(JSON.parse(buildHumanReply('round_table', { ...answerFor('round_table'), speech: 'hello' })).speech).toBe('hello');
  });

  it('maps the none choices: no whisper, no offer', () => {
    const none = { ...emptyAnswer(), choice: null };
    expect(JSON.parse(buildHumanReply('whispers', none)).action).toEqual({ to: null });
    expect(JSON.parse(buildHumanReply('recruit_choose', none)).action).toEqual({ target: null });
    expect(parseReply('whispers', buildHumanReply('whispers', none), options)).toMatchObject({ ok: true });
    expect(parseReply('recruit_choose', buildHumanReply('recruit_choose', none), options)).toMatchObject({ ok: true });
  });

  it('maps accept and refuse', () => {
    expect(JSON.parse(buildHumanReply('recruit_respond', { ...emptyAnswer(), choice: 'accept' })).action).toEqual({ accept: true });
    expect(JSON.parse(buildHumanReply('recruit_respond', { ...emptyAnswer(), choice: 'refuse' })).action).toEqual({ accept: false });
  });
});

describe('formFor', () => {
  it('gives every phase a title and a visible heading for its choices', () => {
    for (const p of PHASES) {
      const spec = formFor(p, optionsFor(p));
      expect(spec.title, p).not.toBe('');
      expect(spec.choiceLabel, p).not.toBe('');
      expect(spec.choices.length, p).toBeGreaterThan(0);
    }
  });
});

describe('isComplete', () => {
  it('needs a choice, and speech and a reason at the round table', () => {
    const rt = formFor('round_table', options);
    expect(isComplete(rt, emptyAnswer())).toBe(false);
    expect(isComplete(rt, { ...emptyAnswer(), choice: 'Bram', speech: 'hi', message: '' })).toBe(false);
    expect(isComplete(rt, { ...emptyAnswer(), choice: 'Bram', speech: '  ', message: 'x' })).toBe(false);
    expect(isComplete(rt, { ...emptyAnswer(), choice: 'Bram', speech: 'hi', message: 'x' })).toBe(true);
    expect(isComplete(rt, { ...emptyAnswer(), choice: 'Zed', speech: 'hi', message: 'x' })).toBe(false);
  });

  it('lets a whisper be skipped, but needs a message when sending one', () => {
    const w = formFor('whispers', options);
    expect(isComplete(w, emptyAnswer())).toBe(true);
    expect(isComplete(w, { ...emptyAnswer(), choice: 'Bram' })).toBe(false);
    expect(isComplete(w, { ...emptyAnswer(), choice: 'Bram', message: 'hi' })).toBe(true);
  });

  it('needs a choice for votes and the yes/no phases', () => {
    for (const p of ['night', 'vote', 'revote', 'recruit_respond', 'endgame_vote'] as Phase[]) {
      const spec = formFor(p, optionsFor(p));
      expect(isComplete(spec, emptyAnswer()), p).toBe(false);
      expect(isComplete(spec, { ...emptyAnswer(), choice: spec.choices[0]!.value }), p).toBe(true);
    }
  });
});

describe('splitPrompt', () => {
  const user = ['You are Aria. Your role: faithful.\nRound 1.', 'What you know so far:\nNothing has happened yet.', 'Banishment vote. Vote for the player to banish.\nValid choices: Bram, Cleo.\nUse "speech": "" or a short remark.\nAction: {"target": "<name>"}'].join('\n\n');

  it('separates what you know from the task and drops the JSON-format lines', () => {
    const { context, task } = splitPrompt(user);
    expect(context).toContain('You are Aria.');
    expect(context).toContain('Nothing has happened yet.');
    expect(task).toBe('Banishment vote. Vote for the player to banish.\nValid choices: Bram, Cleo.');
    expect(task).not.toContain('Action:');
    expect(task).not.toContain('"speech"');
  });

  it('copes with a prompt that has only a task', () => {
    expect(splitPrompt('Just one block.')).toEqual({ context: '', task: 'Just one block.' });
  });
});

describe('createHumanPlayer', () => {
  it('turns the form answer into the reply for the phase it was asked', async () => {
    let seen = '';
    const player = createHumanPlayer(async (req) => {
      seen = req.phase;
      return { ...emptyAnswer(), choice: 'Bram', note: 'n' };
    });
    const raw = (await player.respond({ system: 's', user: 'u', phase: 'vote', player: 'Me', options })) as string;
    expect(seen).toBe('vote');
    expect(JSON.parse(raw)).toEqual({ speech: '', private_notes: 'n', action: { target: 'Bram' } });
  });
});
