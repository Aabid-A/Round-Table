import { describe, expect, it } from 'vitest';
import { fallbackAction, parseReply } from '../../src/engine/validate.js';
import { tallyVotes } from '../../src/engine/tally.js';

const opts = ['Bram', 'Cleo'];
const ok = (speech: string, action: unknown): string => JSON.stringify({ speech, private_notes: 'n', action });

describe('parseReply', () => {
  it('accepts a valid reply and strips code fences', () => {
    const raw = '```json\n' + ok('', { target: 'Bram' }) + '\n```';
    expect(parseReply('vote', raw, opts)).toEqual({
      ok: true,
      extracted: false,
      reply: { speech: '', private_notes: 'n', action: { target: 'Bram' } },
    });
  });

  it('rejects non-JSON without echoing the reply', () => {
    const r = parseReply('vote', 'SECRET not json', opts);
    expect(r).toEqual({ ok: false, error: 'reply is not valid JSON' });
  });

  it('rejects missing fields', () => {
    expect(parseReply('vote', JSON.stringify({ speech: '', action: {} }), opts)).toMatchObject({ ok: false });
    expect(parseReply('vote', JSON.stringify({ private_notes: '', action: {} }), opts)).toMatchObject({ ok: false });
  });

  it('rejects a target that is not a valid option', () => {
    const r = parseReply('vote', ok('', { target: 'Zed' }), opts);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain('Bram, Cleo');
  });

  it('requires speech and a reason at the round table', () => {
    expect(parseReply('round_table', ok('', { suspect: 'Bram', reason: 'x' }), opts)).toMatchObject({ ok: false });
    expect(parseReply('round_table', ok('hi', { suspect: 'Bram', reason: ' ' }), opts)).toMatchObject({ ok: false });
    expect(parseReply('round_table', ok('hi', { suspect: 'Bram', reason: 'x' }), opts)).toMatchObject({ ok: true });
  });

  it('handles whispers, recruitment and the endgame vote', () => {
    expect(parseReply('whispers', ok('', { to: null }), opts)).toMatchObject({ ok: true });
    expect(parseReply('whispers', ok('', { to: 'Bram' }), opts)).toMatchObject({ ok: false });
    expect(parseReply('whispers', ok('', { to: 'Bram', message: 'hey' }), opts)).toMatchObject({ ok: true });
    expect(parseReply('recruit_choose', ok('', { target: null }), opts)).toMatchObject({ ok: true });
    expect(parseReply('recruit_respond', ok('', { accept: 'yes' }), [])).toMatchObject({ ok: false });
    expect(parseReply('endgame_vote', ok('', { choice: 'end' }), [])).toMatchObject({ ok: true });
    expect(parseReply('endgame_vote', ok('', { choice: 'maybe' }), [])).toMatchObject({ ok: false });
  });
});

describe('parseReply with text around the JSON', () => {
  const json = ok('', { target: 'Bram' });

  it('extracts a single object after a sentence and marks it extracted', () => {
    const r = parseReply('vote', `Sure, here is my answer:\n${json}\nGood luck!`, opts);
    expect(r).toMatchObject({ ok: true, extracted: true, reply: { action: { target: 'Bram' } } });
  });

  it('is not fooled by braces inside strings or by a fenced block with prose', () => {
    const tricky = JSON.stringify({ speech: 'a } brace { here', private_notes: 'say "hi" {x}', action: { target: 'Cleo' } });
    expect(parseReply('vote', `Thinking... ${tricky} done`, opts)).toMatchObject({ ok: true, extracted: true, reply: { speech: 'a } brace { here', action: { target: 'Cleo' } } });
    expect(parseReply('vote', 'My reply:\n```json\n' + json + '\n```', opts)).toMatchObject({ ok: true, extracted: true });
  });

  it('rejects text with no object, or with more than one', () => {
    expect(parseReply('vote', 'I think Bram.', opts)).toEqual({ ok: false, error: 'reply is not valid JSON' });
    expect(parseReply('vote', `${json} and also ${ok('', { target: 'Cleo' })}`, opts)).toEqual({
      ok: false,
      error: 'reply contains more than one JSON object',
    });
  });

  it('still validates the extracted object', () => {
    expect(parseReply('vote', `Here: ${ok('', { target: 'Zed' })}`, opts)).toMatchObject({ ok: false });
  });

  it('does not echo the reply in errors', () => {
    const r = parseReply('vote', 'SECRET {not json} SECRET', opts);
    expect(JSON.stringify(r)).not.toContain('SECRET');
  });
});

describe('fallbackAction', () => {
  it('is deterministic and always valid', () => {
    expect(fallbackAction('vote', opts, 3)).toEqual({ target: 'Cleo' });
    expect(fallbackAction('vote', opts, 3)).toEqual(fallbackAction('vote', opts, 3));
    expect(fallbackAction('whispers', opts, 0)).toEqual({ to: null, message: '' });
    expect(fallbackAction('endgame_vote', [], 0)).toEqual({ choice: 'banish' });
  });
});

describe('tallyVotes', () => {
  it('finds a single leader and a tie', () => {
    const c = ['A', 'B', 'C'];
    expect(tallyVotes([{ target: 'A' }, { target: 'A' }, { target: 'B' }], c).leaders).toEqual(['A']);
    expect(tallyVotes([{ target: 'A' }, { target: 'B' }], c).leaders).toEqual(['A', 'B']);
  });
});
