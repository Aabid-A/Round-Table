import { describe, expect, it } from 'vitest';
import { AI_NAMES, buildRoomCast, HUMAN_MODEL } from '../src/cast.js';

describe('buildRoomCast', () => {
  it('fills eight seats: the people and AIs for the rest', () => {
    for (const n of [1, 3, 8]) {
      const humans = ['Quinn', 'Rae', 'Sam', 'Tia', 'Uma', 'Vic', 'Wes', 'Xan'].slice(0, n);
      const cast = buildRoomCast(humans, null, 5);
      expect(cast).toHaveLength(8);
      expect(cast.filter((c) => c.model === HUMAN_MODEL).map((c) => c.name).sort()).toEqual([...humans].sort());
      expect(cast.filter((c) => c.model === 'mock').map((c) => c.name).sort()).toEqual(AI_NAMES.slice(0, 8 - n).sort());
    }
  });

  it('gives AI seats the models in turn, repeating when there are fewer IDs than seats', () => {
    const cast = buildRoomCast(['Quinn'], ['a/x', 'b/y'], 1);
    for (const c of cast.filter((x) => x.model !== HUMAN_MODEL)) expect(c.model, c.name).toBe(AI_NAMES.indexOf(c.name) % 2 === 0 ? 'a/x' : 'b/y');
    expect(cast.filter((c) => c.model === 'a/x')).toHaveLength(4);
    expect(cast.filter((c) => c.model === 'b/y')).toHaveLength(3);
  });

  it('seats the same way for the same seed, and differently for another', () => {
    const order = (seed: number) => buildRoomCast(['Quinn', 'Rae'], null, seed).map((c) => c.name).join();
    expect(order(3)).toBe(order(3));
    expect(new Set([1, 2, 3, 4, 5, 6].map(order)).size).toBeGreaterThan(1);
  });

  it('refuses nobody, nine people, and an empty model list', () => {
    expect(() => buildRoomCast([], null, 1)).toThrow('1 to 8');
    expect(() => buildRoomCast(Array.from({ length: 9 }, (_, i) => `P${i}`), null, 1)).toThrow('1 to 8');
    expect(() => buildRoomCast(['Quinn'], [], 1)).toThrow('at least one model');
  });
});
