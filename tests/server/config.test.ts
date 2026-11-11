import { describe, expect, it } from 'vitest';
import { msFromEnv } from '../../server/config.js';

describe('msFromEnv', () => {
  it('uses the fallback when unset or empty', () => {
    expect(msFromEnv({}, 'TURN_MS', 90_000)).toBe(90_000);
    expect(msFromEnv({ TURN_MS: '  ' }, 'TURN_MS', 90_000)).toBe(90_000);
  });
  it('reads a whole number of milliseconds', () => {
    expect(msFromEnv({ TURN_MS: '4000' }, 'TURN_MS', 90_000)).toBe(4000);
  });
  it('refuses anything else, naming the variable', () => {
    for (const bad of ['abc', '1.5', '-5', '99', '86400001', '1e3x']) expect(() => msFromEnv({ TURN_MS: bad }, 'TURN_MS', 1), bad).toThrow('TURN_MS must be');
  });
});
