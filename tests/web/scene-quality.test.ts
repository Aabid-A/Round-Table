import { describe, expect, it } from 'vitest';
import { chooseQuality, HIGH_MAX_MS, MEDIUM_MAX_MS, QUALITY, qualityFromSearch } from '../../web/src/scene/stage/quality.js';

describe('quality levels', () => {
  it('pick high for a fast machine, medium for a middling one and low for a slow one, by the median frame', () => {
    expect(chooseQuality(Array(30).fill(11))).toBe('high');
    expect(chooseQuality(Array(30).fill(HIGH_MAX_MS))).toBe('high');
    expect(chooseQuality(Array(30).fill(HIGH_MAX_MS + 1))).toBe('medium');
    expect(chooseQuality(Array(30).fill(MEDIUM_MAX_MS))).toBe('medium');
    expect(chooseQuality(Array(30).fill(MEDIUM_MAX_MS + 1))).toBe('low');
  });

  it('is not decided by a few slow frames, such as the first ones while shaders compile', () => {
    expect(chooseQuality([400, 300, 200, ...Array(27).fill(12)])).toBe('high');
    expect(chooseQuality([])).toBe('medium');
  });

  it('drops shadows and post-processing before geometry: each lower level has no more of either', () => {
    const order = ['high', 'medium', 'low'] as const;
    for (const key of ['shadows', 'bloom', 'grain', 'depthOfField', 'antialias'] as const) {
      for (let i = 1; i < order.length; i++) expect(Number(QUALITY[order[i]!][key]), `${key} at ${order[i]}`).toBeLessThanOrEqual(Number(QUALITY[order[i - 1]!][key]));
    }
    expect(QUALITY.low.shadows).toBe(false);
    expect(QUALITY.low.bloom).toBe(false);
    expect(QUALITY.high.dpr[1]).toBeGreaterThanOrEqual(QUALITY.low.dpr[1]);
  });

  it('can be fixed from the address', () => {
    expect(qualityFromSearch('?mode=slice&quality=low')).toBe('low');
    expect(qualityFromSearch('?quality=ultra')).toBeNull();
    expect(qualityFromSearch('')).toBeNull();
  });
});

describe('too slow for the room', () => {
  it('is a median frame over 100 ms, so one slow frame does not decide', async () => {
    const { tooSlow } = await import('../../web/src/scene/stage/quality.js');
    expect(tooSlow([])).toBe(false);
    expect(tooSlow([16, 16, 400, 16, 16])).toBe(false);
    expect(tooSlow([120, 130, 90, 140, 150])).toBe(true);
  });
});

describe('the WebGL check', () => {
  it('asks the browser once per page and releases the context it opened', async () => {
    let made = 0;
    let released = 0;
    const fake = { getExtension: () => ({ loseContext: () => void released++ }) };
    const doc = { createElement: () => ({ getContext: () => (made++, fake) }) };
    const g = globalThis as unknown as { document?: unknown };
    const before = g.document;
    g.document = doc;
    try {
      const { hasWebGl2 } = await import('../../web/src/scene/webgl.js');
      expect(hasWebGl2()).toBe(true);
      expect(hasWebGl2()).toBe(true);
      expect(made).toBe(1);
      expect(released).toBe(1);
    } finally {
      g.document = before;
    }
  });
});
