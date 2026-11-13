import { describe, expect, it } from 'vitest';
import { approach, idle } from '../../web/src/scene/motion.js';
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
  it('stills idle movement', () => {
    expect(idle(false)).toBe(1);
    expect(idle(true)).toBe(0);
  });
});
