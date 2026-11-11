export type Verdict = 'ok' | 'refuse' | 'refuse-quietly';

/**
 * At most `max` messages in any `windowMs`. Past that, messages are refused until the window moves on.
 * The first refusal says so; further ones are dropped without a reply, so a flood cannot make the server flood back.
 */
export class RateLimiter {
  private times: number[] = [];
  private warned = false;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(): Verdict {
    const t = this.now();
    this.times = this.times.filter((x) => t - x < this.windowMs);
    if (this.times.length >= this.max) {
      if (this.warned) return 'refuse-quietly';
      this.warned = true;
      return 'refuse';
    }
    this.warned = false;
    this.times.push(t);
    return 'ok';
  }
}
