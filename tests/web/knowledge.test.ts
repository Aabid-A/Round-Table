import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { knowledgeAt, parsePrompt } from '../../web/src/perspective/knowledge.js';
import { playMock } from '../helpers/game.js';

const sample = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;

describe('parsePrompt', () => {
  it('reads every prompt in a real game back into facts that match the game', async () => {
    const log = await playMock(3);
    let read = 0;
    for (const t of log.turns) {
      const k = parsePrompt(t.attempts[0]!.prompt);
      expect(k, `turn ${t.id}`).not.toBeNull();
      expect(k!.role).toBe(log.roles[t.player]);
      expect(k!.alive).toContain(t.player);
      expect(k!.round).toBe(t.round);
      if (k!.role === 'faithful') expect(k!.fellowTraitors).toEqual([]);
      read++;
    }
    expect(read).toBeGreaterThan(50);
  });

  it('reads the people who are out of the game, with how and what they were', async () => {
    const log = await playMock(3);
    const t = log.turns[log.turns.length - 1]!;
    const k = parsePrompt(t.attempts[0]!.prompt)!;
    expect(k.out.length).toBeGreaterThan(0);
    for (const o of k.out) {
      const event = log.events.find((e) => (e.type === 'breakfast' && e.victim === o.name) || (e.type === 'banishment' && e.player === o.name));
      expect(event, o.name).toBeDefined();
      expect(o.how).toBe(event!.type === 'breakfast' ? 'murdered' : 'banished');
      expect(o.role).toBe((event as { role: string }).role);
    }
    expect(k.alive.some((n) => k.out.some((o) => o.name === n))).toBe(false);
  });

  it('reads a traitor’s fellows and the people who are out, with their roles', () => {
    const late = [...sample.turns].reverse().find((t) => sample.roles[t.player] === 'traitor')!;
    const k = parsePrompt(late.attempts[0]!.prompt)!;
    expect(k.role).toBe('traitor');
    for (const f of k.fellowTraitors) expect(sample.roles[f]).toBe('traitor');
    for (const o of k.out) expect(['murdered', 'banished']).toContain(o.how);
  });

  it('returns null for text that is not one of the game prompts', () => {
    expect(parsePrompt('hello')).toBeNull();
    expect(parsePrompt('You are A. Your role: wizard.\n\nWhat you know so far:\nx\n\ny')).toBeNull();
  });
});

describe('knowledgeAt', () => {
  it('is null before the seat’s first turn and follows its latest prompt after', () => {
    const first = sample.turns.find((t) => t.player === sample.cast[0]!.name)!;
    expect(knowledgeAt(sample, first.player, first.id - 1)).toBeNull();
    expect(knowledgeAt(sample, first.player, first.id)?.role).toBe(sample.roles[first.player]);
    const last = knowledgeAt(sample, first.player, 10_000)!;
    const first_ = knowledgeAt(sample, first.player, first.id)!;
    expect(last.history.length).toBeGreaterThanOrEqual(first_.history.length);
  });
});
