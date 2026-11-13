import { describe, expect, it } from 'vitest';
import { approach, idle, spring } from '../../web/src/scene/motion.js';
import { SceneResources, together } from '../../web/src/scene/resources.js';

describe('what a scene has built', () => {
  it('makes a thing once per name and shares it', () => {
    const store = new SceneResources();
    let made = 0;
    const make = () => ({ id: ++made, dispose: () => {} });
    const a = store.get('wood', make);
    expect(store.get('wood', make)).toBe(a);
    expect(store.get('stone', make)).not.toBe(a);
    expect(made).toBe(2);
    expect(store.size).toBe(2);
  });
  it('releases everything when the scene is taken down, once each, and can start again', () => {
    const store = new SceneResources();
    const disposed: string[] = [];
    store.get('a', () => ({ dispose: () => disposed.push('a') }));
    store.get('b', () => together({ map: { dispose: () => disposed.push('b.map') }, bump: { dispose: () => disposed.push('b.bump') } }));
    store.disposeAll();
    expect(disposed.sort()).toEqual(['a', 'b.bump', 'b.map']);
    expect(store.size).toBe(0);
    store.disposeAll();
    expect(disposed).toHaveLength(3);
    let again = 0;
    store.get('a', () => ({ dispose: () => again++ }));
    expect(store.size).toBe(1);
  });
});

describe('reduced motion', () => {
  it('eases toward a target normally and cuts to it when motion is reduced', () => {
    expect(approach(0.016, 4, false)).toBeGreaterThan(0);
    expect(approach(0.016, 4, false)).toBeLessThan(0.1);
    expect(approach(0.016, 4, true)).toBe(1);
  });
  it('springs past its target a little and settles, and is simply set when motion is reduced', () => {
    const s = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < 300; i++) peak = Math.max(peak, spring(s, 1, 1 / 60, 70, 11, false));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.25);
    expect(s.x).toBeCloseTo(1, 2);
    // A very long frame cannot throw it off.
    expect(Number.isFinite(spring({ x: 0, v: 0 }, 1, 5, 80, 12, false))).toBe(true);
    const r = { x: 0, v: 3 };
    expect(spring(r, 1, 1 / 60, 70, 11, true)).toBe(1);
    expect(r.v).toBe(0);
  });
  it('stills idle movement', () => {
    expect(idle(false)).toBe(1);
    expect(idle(true)).toBe(0);
  });
});
