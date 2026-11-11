import { describe, expect, it } from 'vitest';
import { LIMITS, normalizeCode, parseClientMessage } from '../../server/protocol.js';

const ok = (m: unknown) => parseClientMessage(JSON.stringify(m));
const error = (m: unknown): string => {
  const r = ok(m);
  if (r.ok) throw new Error('expected a refusal');
  return r.error;
};

describe('parseClientMessage', () => {
  it('reads each message type', () => {
    expect(ok({ t: 'create', name: 'Quinn', mode: 'mock', seed: 7 })).toEqual({ ok: true, msg: { t: 'create', name: 'Quinn', mode: 'mock', seed: 7 } });
    expect(ok({ t: 'join', code: 'ab2cd', name: 'Rae' })).toEqual({ ok: true, msg: { t: 'join', code: 'AB2CD', name: 'Rae' } });
    expect(ok({ t: 'start' })).toEqual({ ok: true, msg: { t: 'start' } });
    expect(ok({ t: 'leave' })).toEqual({ ok: true, msg: { t: 'leave' } });
    const token = '123e4567-e89b-12d3-a456-426614174000';
    expect(ok({ t: 'rejoin', code: 'AB2CD', token })).toEqual({ ok: true, msg: { t: 'rejoin', code: 'AB2CD', token } });
    expect(ok({ t: 'answer', turn: 3, answer: { speech: 'hi', note: 'n', choice: 'Bram', message: 'm' } })).toEqual({
      ok: true,
      msg: { t: 'answer', turn: 3, answer: { speech: 'hi', note: 'n', choice: 'Bram', message: 'm' } },
    });
  });

  it('reads the aliases option for either kind of room, and only when it is true', () => {
    expect(ok({ t: 'create', name: 'Quinn', mode: 'mock', aliases: true })).toEqual({ ok: true, msg: { t: 'create', name: 'Quinn', mode: 'mock', aliases: true } });
    expect(ok({ t: 'create', name: 'Quinn', mode: 'mock', aliases: false })).toEqual({ ok: true, msg: { t: 'create', name: 'Quinn', mode: 'mock' } });
    const real = ok({ t: 'create', name: 'Quinn', mode: 'openrouter', key: 'sk-x', models: ['a/b'], maxCostUsd: 1, aliases: true });
    expect(real.ok && real.msg).toMatchObject({ aliases: true });
    expect(error({ t: 'create', name: 'Quinn', mode: 'mock', aliases: 'yes' })).toBe('Aliases must be on or off.');
  });

  it('reads a guess: up to eight names, once each', () => {
    expect(ok({ t: 'guess', ai: ['Aria', 'Bram', 'Aria'] })).toEqual({ ok: true, msg: { t: 'guess', ai: ['Aria', 'Bram'] } });
    expect(ok({ t: 'guess', ai: [] })).toEqual({ ok: true, msg: { t: 'guess', ai: [] } });
    for (const bad of [undefined, 'Aria', [1], [''], ['x'.repeat(21)], Array(9).fill('Aria')]) expect(error({ t: 'guess', ai: bad }), String(bad)).toBe('That guess is not valid.');
  });

  it('refuses text that is not JSON, not an object, or has no type', () => {
    expect(parseClientMessage('nope')).toEqual({ ok: false, error: 'Messages must be JSON.' });
    expect(parseClientMessage('[1]')).toEqual({ ok: false, error: 'Messages need a type.' });
    expect(error({ t: 'dance' })).toBe('Unknown message type.');
  });

  it('refuses a message over the byte limit before parsing it', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'start', pad: 'x'.repeat(LIMITS.messageBytes) }))).toEqual({ ok: false, error: 'That message is too long.' });
  });

  it('checks names the same way the solo page does, and cleans them', () => {
    expect(error({ t: 'create', name: 'Aria', mode: 'mock' })).toContain("AI's name");
    expect(error({ t: 'join', code: 'AB2CD', name: '<b>x</b>' })).toContain('letters, numbers');
    expect(error({ t: 'join', code: 'AB2CD', name: 7 })).toBe('Enter a name.');
    expect(ok({ t: 'join', code: 'AB2CD', name: '  Sam  ' })).toEqual({ ok: true, msg: { t: 'join', code: 'AB2CD', name: 'Sam' } });
  });

  it('needs a key, model IDs and a sane cap for real models', () => {
    const base = { t: 'create', name: 'Quinn', mode: 'openrouter', key: 'sk-x', models: ['a/b'], maxCostUsd: 1 };
    expect(ok(base).ok).toBe(true);
    expect(error({ ...base, key: '  ' })).toContain('Paste your OpenRouter key');
    expect(error({ ...base, key: 'has space' })).toContain('Paste your OpenRouter key');
    expect(error({ ...base, key: 'k'.repeat(LIMITS.key + 1) })).toContain('Paste your OpenRouter key');
    expect(error({ ...base, models: [] })).toContain('model IDs');
    expect(error({ ...base, models: Array(8).fill('a/b') })).toContain('model IDs');
    expect(error({ ...base, models: ['has space'] })).toContain('model IDs');
    for (const cap of [0, -1, Number.NaN, '5', LIMITS.maxCostUsd + 1]) expect(error({ ...base, maxCostUsd: cap }), String(cap)).toContain('spend cap');
    expect(error({ ...base, mode: 'other' })).toContain('Choose');
  });

  it('cleans an answer: flat text, capped length, and only a name-sized choice', () => {
    const long = 'x'.repeat(2000); // three of these still fit under the message limit
    const r = ok({ t: 'answer', turn: 1, answer: { speech: `a\n\nb ${long}`, note: long, choice: null, message: long } });
    if (!r.ok || r.msg.t !== 'answer') throw new Error('expected an answer');
    expect(r.msg.answer.speech.startsWith('a b ')).toBe(true);
    expect(r.msg.answer.speech.length).toBe(LIMITS.speech);
    expect(r.msg.answer.note.length).toBe(LIMITS.note);
    expect(r.msg.answer.message.length).toBe(LIMITS.message);
    expect(error({ t: 'answer', turn: 1, answer: { choice: 'x'.repeat(100) } })).toContain('choice');
    expect(error({ t: 'answer', turn: 1.5, answer: {} })).toContain('incomplete');
  });
});

describe('normalizeCode', () => {
  it('accepts five letters and digits without lookalikes, in any case', () => {
    expect(normalizeCode(' ab2cd ')).toBe('AB2CD');
    for (const bad of ['AB2C', 'AB2CDE', 'AB0CD', 'AB1CD', 'ABOCD', 7, null]) expect(normalizeCode(bad), String(bad)).toBeNull();
  });
});
