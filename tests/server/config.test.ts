import { describe, expect, it } from 'vitest';
import { countFromEnv, msFromEnv, originAllowed, parseOrigins, positiveFromEnv } from '../../server/config.js';

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

  it('treats an empty value as unset, and takes a range for a port', () => {
    expect(countFromEnv({ PORT: '' }, 'PORT', 8787, 1, 65535)).toBe(8787);
    expect(countFromEnv({ PORT: '  ' }, 'PORT', 8787, 1, 65535)).toBe(8787);
    expect(countFromEnv({ PORT: '65535' }, 'PORT', 8787, 1, 65535)).toBe(65535);
    for (const bad of ['0', '65536', 'abc', '80.5']) expect(() => countFromEnv({ PORT: bad }, 'PORT', 8787, 1, 65535), bad).toThrow('PORT must be a whole number from 1 to 65535.');
  });
});

describe('parseOrigins', () => {
  it('is no restriction when unset or empty', () => {
    expect(parseOrigins({})).toBeUndefined();
    expect(parseOrigins({ ALLOWED_ORIGINS: '' })).toBeUndefined();
    expect(parseOrigins({ ALLOWED_ORIGINS: '   ' })).toBeUndefined();
  });

  it('reads comma-separated origins, trimmed, in lower case, without a trailing slash, once each', () => {
    expect(parseOrigins({ ALLOWED_ORIGINS: ' https://Play.Example.org , http://localhost:5173/ ,https://play.example.org,' })).toEqual(['https://play.example.org', 'http://localhost:5173']);
  });

  it('refuses anything that is not an origin, naming the entry: a star, a path, a bare host, another scheme, a blank list', () => {
    for (const bad of ['*', 'https://example.org/path', 'example.org', 'ftp://example.org', 'https://', 'https://user@example.org', ',', 'https://a.org, *']) {
      expect(() => parseOrigins({ ALLOWED_ORIGINS: bad }), bad).toThrow('ALLOWED_ORIGINS');
    }
    expect(() => parseOrigins({ ALLOWED_ORIGINS: '*' })).toThrow('has "*"');
  });
});

describe('originAllowed', () => {
  const list = ['https://play.example.org', 'http://localhost:5173'];
  it('allows everything when there is no list', () => {
    expect(originAllowed('https://anything.example', undefined)).toBe(true);
    expect(originAllowed(undefined, undefined)).toBe(true);
  });

  it('allows only listed origins, ignoring case and a trailing slash, and refuses a missing Origin header', () => {
    expect(originAllowed('https://play.example.org', list)).toBe(true);
    expect(originAllowed('HTTPS://Play.Example.org/', list)).toBe(true);
    expect(originAllowed('https://evil.example', list)).toBe(false);
    expect(originAllowed('https://play.example.org.evil.example', list)).toBe(false);
    expect(originAllowed('http://play.example.org', list)).toBe(false); // the scheme counts
    expect(originAllowed('https://play.example.org:8443', list)).toBe(false); // so does the port
    expect(originAllowed(undefined, list)).toBe(false);
    expect(originAllowed('', list)).toBe(false);
    expect(originAllowed('null', list)).toBe(false); // what a sandboxed page sends
  });
});

describe('positiveFromEnv', () => {
  it('uses the fallback when unset or empty, reads a positive decimal, and refuses anything else', () => {
    expect(positiveFromEnv({}, 'COST_FLOOR_USD', undefined)).toBeUndefined();
    expect(positiveFromEnv({ COST_FLOOR_USD: '' }, 'COST_FLOOR_USD', 0.01)).toBe(0.01);
    expect(positiveFromEnv({ COST_FLOOR_USD: '0.025' }, 'COST_FLOOR_USD', undefined)).toBe(0.025);
    for (const bad of ['0', '-1', 'abc', 'NaN', 'Infinity']) expect(() => positiveFromEnv({ COST_FLOOR_USD: bad }, 'COST_FLOOR_USD', undefined), bad).toThrow('COST_FLOOR_USD must be a number above 0.');
  });
});
