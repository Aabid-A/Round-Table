import { summaryLine } from '../log/summary.js';
import { writeGameLog } from '../log/writer.js';
import { playGame, type Setup } from './setup.js';

export interface BatchResult {
  lines: string[];
  failed: number;
}

/** Play one game per seed, write each log, and print one summary line per game. */
export async function runBatch(
  setup: Setup,
  seeds: number[],
  outDir: string,
  print: (line: string) => void,
): Promise<BatchResult> {
  const lines: string[] = [];
  let failed = 0;
  for (const seed of seeds) {
    let line: string;
    try {
      const log = await playGame(setup, seed);
      line = `${summaryLine(log)} | ${writeGameLog(log, outDir, setup.gameName(seed))}`;
    } catch (e) {
      failed++;
      line = `seed ${seed} | error: ${e instanceof Error ? e.message : String(e)}`;
    }
    lines.push(line);
    print(line);
  }
  return { lines, failed };
}
