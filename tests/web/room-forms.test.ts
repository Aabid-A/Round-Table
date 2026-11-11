import { describe, expect, it } from 'vitest';
import { checkCreate, checkJoin, parseModelIds } from '../../web/src/rooms/forms.js';

const real = { name: 'Quinn', real: true, key: ' sk-x ', models: 'a/b\nc/d', cap: '2.50', aliases: false };

describe('parseModelIds', () => {
  it('takes one to seven IDs by line or comma', () => {
    expect(parseModelIds('a/b')).toEqual({ ok: true, value: ['a/b'] });
    expect(parseModelIds('a/b, c/d\n\n e/f ')).toEqual({ ok: true, value: ['a/b', 'c/d', 'e/f'] });
  });
  it('says what is wrong', () => {
    expect(parseModelIds('  ')).toEqual({ ok: false, message: 'Enter 1 to 7 model IDs (one per line); you entered 0.' });
    expect(parseModelIds('a,b,c,d,e,f,g,h')).toMatchObject({ ok: false, message: expect.stringContaining('you entered 8') });
    expect(parseModelIds('a/b c/d,e/f')).toMatchObject({ ok: false, message: expect.stringContaining('has a space') });
  });
});

describe('checkCreate', () => {
  it('needs only a good name for practice AIs, and ignores the real-model fields', () => {
    expect(checkCreate({ ...real, real: false, key: '', models: '', cap: 'x' })).toEqual({ ok: true, value: { t: 'create', name: 'Quinn', mode: 'mock' } });
    expect(checkCreate({ ...real, real: false, name: 'Aria' })).toMatchObject({ ok: false, message: expect.stringContaining("AI's name") });
  });
  it('builds the message for real models with a trimmed key and a number cap', () => {
    expect(checkCreate(real)).toEqual({ ok: true, value: { t: 'create', name: 'Quinn', mode: 'openrouter', key: 'sk-x', models: ['a/b', 'c/d'], maxCostUsd: 2.5 } });
  });
  it('asks for aliases only when the box is ticked, in either kind of room', () => {
    expect(checkCreate({ ...real, real: false, aliases: true })).toEqual({ ok: true, value: { t: 'create', name: 'Quinn', mode: 'mock', aliases: true } });
    expect(checkCreate({ ...real, aliases: true })).toMatchObject({ ok: true, value: { mode: 'openrouter', aliases: true } });
    expect(checkCreate({ ...real, aliases: false })).not.toHaveProperty('value.aliases');
  });
  it('checks the key, the IDs and the cap, in that order', () => {
    expect(checkCreate({ ...real, key: ' ' })).toEqual({ ok: false, message: 'Paste your OpenRouter key.' });
    expect(checkCreate({ ...real, key: 'a b' })).toEqual({ ok: false, message: 'Paste your OpenRouter key.' });
    expect(checkCreate({ ...real, models: '' })).toMatchObject({ ok: false, message: expect.stringContaining('model IDs') });
    for (const cap of ['0', '-1', 'abc', '', '26', 'NaN']) expect(checkCreate({ ...real, cap }), cap).toEqual({ ok: false, message: 'The spend cap must be above 0 and at most $25.' });
  });
});

describe('checkJoin', () => {
  it('standardises the code and checks the name', () => {
    expect(checkJoin({ code: ' ab2cd ', name: 'Rae' })).toEqual({ ok: true, value: { t: 'join', code: 'AB2CD', name: 'Rae' } });
    expect(checkJoin({ code: 'AB2C', name: 'Rae' })).toEqual({ ok: false, message: 'Enter the 5-letter room code from your friend.' });
    expect(checkJoin({ code: 'AB2CD', name: '<b>' })).toMatchObject({ ok: false });
  });
});
