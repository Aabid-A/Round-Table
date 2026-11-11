import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../../server/rateLimit.js';

describe('RateLimiter', () => {
  it('allows max messages per window, refuses the next, and recovers as the window moves', () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    expect([limiter.check(), limiter.check(), limiter.check()]).toEqual(['ok', 'ok', 'ok']);
    expect(limiter.check()).toBe('refuse');
    now = 999;
    expect(limiter.check()).toBe('refuse-quietly');
    now = 1000; // the three messages sent at 0 are now a full window old
    expect([limiter.check(), limiter.check(), limiter.check()]).toEqual(['ok', 'ok', 'ok']);
    expect(limiter.check()).toBe('refuse');
  });

  it('counts refused messages as nothing: a flood does not extend the wait', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    limiter.check();
    limiter.check();
    for (let i = 0; i < 50; i++) limiter.check();
    now = 1000;
    expect(limiter.check()).toBe('ok');
  });
});
