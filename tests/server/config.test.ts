import { describe, expect, it } from 'vitest';
import { countFromEnv, msFromEnv } from '../../server/config.js';

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

describe('countFromEnv', () => {
  it('uses the fallback, reads a whole number, and refuses anything else', () => {
    expect(countFromEnv({}, 'MAX_ROOMS_PER_ADDRESS', 3)).toBe(3);
    expect(countFromEnv({ MAX_ROOMS_PER_ADDRESS: '50' }, 'MAX_ROOMS_PER_ADDRESS', 3)).toBe(50);
    for (const bad of ['0', '-1', 'x', '2.5', '100001']) expect(() => countFromEnv({ N: bad }, 'N', 3), bad).toThrow('N must be a whole number from 1 to 100000.');
  });
});
