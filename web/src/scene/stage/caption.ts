/** Break a caption into lines of at most `max` characters, at spaces. A word longer than a line gets a line to itself. */
export function wrapCaption(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const FADE_IN = 0.5;
const FADE_OUT = 1.6;

/** How long a caption stays fully lit, in seconds: long enough to read at an easy pace, and never less than four seconds. */
export const captionHold = (text: string): number => Math.max(4, text.length * 0.075);

/** How visible a caption is `age` seconds after it appeared: it comes up, holds while it is read, and fades away. */
export function captionOpacity(age: number, hold: number): number {
  if (age <= 0) return 0;
  if (age < FADE_IN) return age / FADE_IN;
  if (age < FADE_IN + hold) return 1;
  return Math.max(0, 1 - (age - FADE_IN - hold) / FADE_OUT);
}
