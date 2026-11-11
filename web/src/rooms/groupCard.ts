import type { GameLog } from '../../../src/engine/types.js';
import type { RoomOutcome } from '../../../src/roomResult.js';
import { limitLines, wrap } from '../canvasText.js';
import { groupCardText } from './groupCardText.js';

export const GROUP_CARD = { width: 1200, height: 675 } as const;

/** Draw the group result card as a 1200x675 picture. Colours come from the page's tokens, so it follows light and dark. */
export function drawGroupCard(canvas: HTMLCanvasElement, log: GameLog, outcome: RoomOutcome): void {
  const { width, height } = GROUP_CARD;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the card.');
  const css = getComputedStyle(document.documentElement);
  const token = (n: string): string => css.getPropertyValue(n).trim() || '#888';
  const font = css.getPropertyValue('--font').trim() || 'sans-serif';
  const pad = 64;
  const textWidth = width - pad * 2;
  const text = groupCardText(log, outcome);

  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = token('--text');
  ctx.font = `700 26px ${font}`;
  ctx.fillText('ROUND TABLE', pad, 84);
  ctx.fillStyle = token('--muted');
  ctx.font = `400 26px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText('Human or AI?', width - pad, 84);
  ctx.textAlign = 'left';

  // The headline gets up to three lines at a large size, so a long figure still fits the card.
  ctx.fillStyle = token('--text');
  ctx.font = `700 76px ${font}`;
  const headline = limitLines(ctx, wrap(ctx, text.headline, textWidth), 3, textWidth);
  headline.forEach((l, i) => ctx.fillText(l, pad, 190 + i * 88));

  // The facts sit at the bottom of the card, so the headline has the top and the card has no empty bottom third.
  ctx.fillStyle = token('--muted');
  ctx.font = `400 32px ${font}`;
  const detail = limitLines(
    ctx,
    text.lines.flatMap((line) => limitLines(ctx, wrap(ctx, line, textWidth), 2, textWidth)),
    5,
    textWidth,
  );
  const firstBaseline = height - pad - (detail.length - 1) * 44;
  detail.forEach((l, i) => ctx.fillText(l, pad, firstBaseline + i * 44));
}

export function groupCardPng(log: GameLog, outcome: RoomOutcome): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawGroupCard(canvas, log, outcome);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))), 'image/png'));
}
