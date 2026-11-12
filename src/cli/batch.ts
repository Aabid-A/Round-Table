import { countUncostedAttempts, summaryLine, totalCostUsd } from '../log/summary.js';
import { redact } from '../redact.js';
import { ensureWritableDir, writeGameLog } from '../log/writer.js';
import { playGame, type Setup } from './setup.js';

export interface BatchResult {
  lines: string[];
  failed: number;
  /** True if any game reported a cost (so a cost cap could apply). */
  sawCost: boolean;
  /** Attempts across all games that reported no cost. */
  uncostedAttempts: number;
}

/** Play one game per seed, write each log, and print one summary line per game. */
export async function runBatch(
  setup: Setup,
  seeds: number[],
  outDir: string,
  print: (line: string) => void,
): Promise<BatchResult> {
  ensureWritableDir(outDir);
  const lines: string[] = [];
  let failed = 0;
  let sawCost = false;
  let uncostedAttempts = 0;
  for (const seed of seeds) {
    let line: string;
    try {
      const log = await playGame(setup, seed);
      if (totalCostUsd(log) !== null) sawCost = true;
      uncostedAttempts += countUncostedAttempts(log);
      line = `${summaryLine(log)} | ${writeGameLog(log, outDir, setup.gameName(seed), setup.secrets)}`;
    } catch (e) {
      failed++;
      line = `seed ${seed} | error: ${redact(e instanceof Error ? e.message : String(e), setup.secrets ?? [])}`;
    }
    lines.push(line);
    print(line);
  }
  return { lines, failed, sawCost, uncostedAttempts };
}
