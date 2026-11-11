const MAX_SEEDS = 1000;

/** Parse "7", "1-20" or a comma list such as "1,5,9-12" into seeds. */
export function parseSeeds(spec: string): number[] {
  const seeds: number[] = [];
  for (const part of spec.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) throw new Error(`--seeds: cannot read "${part.trim()}" (use e.g. 1-20 or 3,7,9-12)`);
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (to < from) throw new Error(`--seeds: range ${from}-${to} runs backwards`);
    if (seeds.length + (to - from + 1) > MAX_SEEDS) throw new Error(`--seeds: at most ${MAX_SEEDS} games per run`);
    for (let s = from; s <= to; s++) seeds.push(s);
  }
  if (seeds.some((s) => !Number.isSafeInteger(s))) throw new Error('--seeds: seed too large');
  return seeds;
}
