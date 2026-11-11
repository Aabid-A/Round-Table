import type { GuessScore, RoundResult } from './score.js';

export { resultCardAlt } from './resultAlt.js';

export const RESULT_CARD = { width: 1200, height: 675 } as const;

const MARK: Record<RoundResult, string> = { all: '✓', some: '~', none: '✗' };

/**
 * Draw the result card on a canvas: episode, one square per round, the score. It names no player and no role. Colours
 * come from the page's CSS tokens, so it matches the current theme.
 */
export function drawResultCard(canvas: HTMLCanvasElement, score: GuessScore, episode: number | null): void {
  const { width, height } = RESULT_CARD;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the card.');
  const css = getComputedStyle(document.documentElement);
  const token = (name: string): string => css.getPropertyValue(name).trim() || '#888';
  const font = css.getPropertyValue('--font').trim() || 'sans-serif';
  const colours: Record<RoundResult, string> = { all: token('--success'), some: token('--hidden-border'), none: token('--muted') };

  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = token('--text');
  ctx.font = `700 28px ${font}`;
  ctx.fillText('ROUND TABLE', 64, 88);
  ctx.fillStyle = token('--muted');
  ctx.font = `400 28px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(episode === null ? 'Guess the traitor' : `Episode ${episode} · Guess the traitor`, width - 64, 88);
  ctx.textAlign = 'left';

  // One square per round, centred; shrink the squares if there are many rounds.
  const n = Math.max(1, score.rounds.length);
  const size = Math.min(120, Math.floor((width - 128 - (n - 1) * 24) / n));
  const total = n * size + (n - 1) * 24;
  let x = Math.round((width - total) / 2);
  const y = 180;
  ctx.font = `700 ${Math.round(size * 0.55)}px ${font}`;
  ctx.textAlign = 'center';
  for (const r of score.rounds) {
    ctx.fillStyle = colours[r.result];
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = token('--bg');
    ctx.fillText(MARK[r.result], x + size / 2, y + size * 0.7);
    x += size + 24;
  }

  ctx.fillStyle = token('--text');
  ctx.font = `700 96px ${font}`;
  ctx.fillText(`${score.correct} of ${score.possible}`, width / 2, 430);
  ctx.fillStyle = token('--muted');
  ctx.font = `400 32px ${font}`;
  ctx.fillText('traitor spots found. Can you do better?', width / 2, 490);
  ctx.textAlign = 'left';
}

/** Draw the card and return it as a PNG blob. */
export function resultCardPng(score: GuessScore, episode: number | null): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawResultCard(canvas, score, episode);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))), 'image/png'));
}
