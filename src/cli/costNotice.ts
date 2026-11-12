import { DEFAULT_COST_FLOOR_USD } from '../engine/types.js';

export interface CostFacts {
  /** The cap was set with --max-cost-usd. */
  capped: boolean;
  /** The floor given with --cost-floor-usd, in USD; undefined means the default was used. */
  floorUsd: number | undefined;
  /** Real-model calls the cap counted as an estimate because no usable cost came back. */
  estimated: number;
  /** True if any call reported a real cost. */
  sawCost: boolean;
}

/** What to tell the person after a capped run, about how the cap counted calls. Empty when there is nothing to say. */
export function costNotice(f: CostFacts): string[] {
  if (!f.capped) return [];
  const lines: string[] = [];
  if (f.estimated > 0) {
    const floor = f.floorUsd ?? DEFAULT_COST_FLOOR_USD;
    const calls = `${f.estimated} real-model call${f.estimated === 1 ? '' : 's'}`;
    lines.push(
      `warning: ${calls} came back with no cost, so --max-cost-usd counted each as an estimate: the largest cost seen so far in that game, or ${floor} dollars if none yet (--cost-floor-usd changes it). The log marks them with costEstimatedUsd.`,
    );
  } else if (!f.sawCost) {
    lines.push('warning: no call cost anything, so --max-cost-usd had nothing to count (mock players are free).');
  }
  return lines;
}
