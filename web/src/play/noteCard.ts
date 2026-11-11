import { clipQuote } from '../card/fit.js';
import type { NoteAboutYou } from './notes.js';

export const NOTE_CARD = { width: 1200, height: 675 } as const;
const MAX_CHARS = 360;

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
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
function limitLines(ctx: CanvasRenderingContext2D, lines: string[], max: number, maxWidth: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1] ?? '';
  while (last !== '' && ctx.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join('');
  kept[max - 1] = `${last}…`;
  return kept;
}

/** Draw "what an AI really thought of you" as a 1200x675 card. Colours come from the page's tokens. */
export function drawNoteCard(canvas: HTMLCanvasElement, note: NoteAboutYou, human: string): void {
  const { width, height } = NOTE_CARD;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the card.');
  const css = getComputedStyle(document.documentElement);
  const token = (n: string): string => css.getPropertyValue(n).trim() || '#888';
  const font = css.getPropertyValue('--font').trim() || 'sans-serif';
  const pad = 64;

  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = token('--text');
  ctx.font = `700 26px ${font}`;
  ctx.fillText('ROUND TABLE', pad, 84);
  ctx.fillStyle = token('--muted');
  ctx.font = `400 26px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(`Round ${note.round}`, width - pad, 84);
  ctx.textAlign = 'left';

  ctx.fillStyle = token('--text');
  ctx.font = `700 44px ${font}`;
  ctx.fillText(`What ${note.player} really thought of ${human}`, pad, 160, width - pad * 2);
  ctx.fillStyle = token('--muted');
  ctx.font = `400 24px ${font}`;
  ctx.fillText(note.model, pad, 196, width - pad * 2);

  const boxY = 232;
  const boxH = height - boxY - pad;
  ctx.fillStyle = token('--hidden-bg');
  ctx.fillRect(pad, boxY, width - pad * 2, boxH);
  ctx.setLineDash([10, 6]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = token('--hidden-border');
  ctx.strokeRect(pad + 1.5, boxY + 1.5, width - pad * 2 - 3, boxH - 3);
  ctx.setLineDash([]);

  ctx.fillStyle = token('--muted');
  ctx.font = `700 20px ${font}`;
  ctx.fillText('THOUGHT, HIDDEN FROM THE PLAYERS', pad + 28, boxY + 44);
  ctx.fillStyle = token('--text');
  ctx.font = `400 32px ${font}`;
  const textWidth = width - pad * 2 - 56;
  const lines = limitLines(ctx, wrap(ctx, clipQuote(note.thought, MAX_CHARS), textWidth), 7, textWidth);
  lines.forEach((l, i) => ctx.fillText(l, pad + 28, boxY + 96 + i * 44));
}

export function noteCardPng(note: NoteAboutYou, human: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawNoteCard(canvas, note, human);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))), 'image/png'));
}
