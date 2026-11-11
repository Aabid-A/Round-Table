import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../server/protocol.js';
import { Registry } from '../../server/registry.js';
import { FakeConn } from './helpers.js';

const mock = { mode: 'mock' } as const;

describe('Registry', () => {
  it('makes rooms with distinct, well-formed codes', () => {
    const registry = new Registry();
    const codes = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const r = registry.create(mock);
      if (!r.ok) throw new Error(r.error);
      expect(r.value.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
      codes.add(r.value.code);
      expect(registry.get(r.value.code)).toBe(r.value);
    }
    expect(codes.size).toBe(30);
  });

  it('retries a code that is taken, and gives up after twenty tries', () => {
    const codes = ['AAAAA', 'AAAAA', 'BBBBB'];
    const registry = new Registry({ makeCode: () => codes.shift() ?? 'BBBBB' });
    expect(registry.create(mock).ok).toBe(true);
    const second = registry.create(mock);
    expect(second.ok && second.value.code).toBe('BBBBB');
    expect(registry.create(mock)).toEqual({ ok: false, error: 'Could not make a room code. Try again.' });
  });

  it('stops at the room limit', () => {
    let n = 0;
    const registry = new Registry({ makeCode: () => `R${String(n++).padStart(4, '2')}` });
    for (let i = 0; i < LIMITS.rooms; i++) expect(registry.create(mock).ok).toBe(true);
    expect(registry.create(mock)).toEqual({ ok: false, error: 'This server is full. Try again in a while.' });
  });

  it('closes and removes rooms past their lifetime, and frees the space', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const old = registry.create(mock);
    if (!old.ok) throw new Error('create');
    const conn = new FakeConn();
    old.value.join('Quinn', conn);
    now = LIMITS.roomTtlMs - 1;
    const fresh = registry.create(mock);
    expect(registry.sweep()).toBe(0);
    now = LIMITS.roomTtlMs;
    expect(registry.sweep()).toBe(1);
    expect(registry.get(old.value.code)).toBeUndefined();
    expect(conn.sent.at(-1)).toEqual({ t: 'closed', reason: 'This room expired.' });
    expect(conn.closed).toBe(true);
    expect(fresh.ok && registry.get(fresh.value.code)).toBeTruthy();
  });

  it('drops the key of an expired or closed room', () => {
    let now = 0;
    const registry = new Registry({ now: () => now });
    const r = registry.create({ mode: 'openrouter', key: 'sk-secret-9', models: ['a/b'], maxCostUsd: 1 });
    if (!r.ok) throw new Error('create');
    now = LIMITS.roomTtlMs;
    registry.sweep();
    expect(r.value.takeSetup()).toEqual({ mode: 'mock' });
  });
});
