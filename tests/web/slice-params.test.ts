import { describe, expect, it } from 'vitest';
import { isSliceMode, paceFromSearch } from '../../web/src/slice/params.js';

describe('slice URL parameters', () => {
  it('opens only for ?mode=slice', () => {
    expect(isSliceMode('?mode=slice')).toBe(true);
    expect(isSliceMode('?mode=replay')).toBe(false);
    expect(isSliceMode('')).toBe(false);
  });
  it('paces from 1 to 4 and ignores anything else', () => {
    expect(paceFromSearch('?mode=slice&pace=2')).toBe(2);
    expect(paceFromSearch('?pace=4')).toBe(4);
    expect(paceFromSearch('?pace=0.2')).toBe(1);
    expect(paceFromSearch('?pace=9')).toBe(1);
    expect(paceFromSearch('?pace=fast')).toBe(1);
    expect(paceFromSearch('')).toBe(1);
  });
});
