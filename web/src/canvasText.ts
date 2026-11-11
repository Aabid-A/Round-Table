/** Text fitting for cards drawn on a canvas. Callers set `ctx.font` first, since widths depend on it. */

/** Break one word that is too wide for a line into pieces that each fit. */
function chop(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const ch of Array.from(word)) {
    if (piece !== '' && ctx.measureText(piece + ch).width > maxWidth) {
      pieces.push(piece);
      piece = ch;
    } else piece += ch;
  }
  if (piece !== '') pieces.push(piece);
  return pieces;
}

/** Break text into lines that fit `maxWidth`, by words; a single word wider than a line is split. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const raw of text.split(/\s+/).filter((w) => w !== '')) {
    const words = ctx.measureText(raw).width > maxWidth ? chop(ctx, raw, maxWidth) : [raw];
    for (const [i, word] of words.entries()) {
      const next = line === '' ? word : i === 0 ? `${line} ${word}` : word;
      if (i === 0 && line !== '' && ctx.measureText(next).width <= maxWidth) line = next;
      else {
        if (line !== '') lines.push(line);
        line = word;
      }
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** At most `max` lines; if there were more, the last one ends in an ellipsis that still fits. */
export function limitLines(ctx: CanvasRenderingContext2D, lines: string[], max: number, maxWidth: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1] ?? '';
  while (last !== '' && ctx.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join('');
  kept[max - 1] = `${last}…`;
  return kept;
}
