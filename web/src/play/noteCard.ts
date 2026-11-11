import { clipQuote } from '../card/fit.js';
import type { NoteAboutYou } from './notes.js';

export const NOTE_CARD = { width: 1200, height: 675 } as const;
const MAX_CHARS = 360;

/** Break text into lines that fit `maxWidth`, by words. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth || line === '') line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
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
  const lines = wrap(ctx, clipQuote(note.thought, MAX_CHARS), width - pad * 2 - 56).slice(0, 7);
  lines.forEach((l, i) => ctx.fillText(l, pad + 28, boxY + 96 + i * 44));
}

export function noteCardPng(note: NoteAboutYou, human: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawNoteCard(canvas, note, human);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image.'))), 'image/png'));
}
