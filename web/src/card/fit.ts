import type { CardSize } from './params.js';

/** The most characters of one quote a card shows; longer quotes are cut at a word with "…". */
export const MAX_QUOTE_CHARS: Record<CardSize, number> = { '1200x675': 360, '1080x1350': 560 };

/** Cut a quote to `max` characters at a word boundary, adding "…". Short quotes come back unchanged. */
export function clipQuote(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  // Cut at a word unless the only space is too early to be worth it.
  const end = space > max * 0.6 ? space : max;
  return `${cut.slice(0, end).replace(/[\s.,;:!?-]+$/, '')}…`;
}

/**
 * How much to scale quote text so it fills its panel without overflowing: bigger for a short quote, smaller for a
 * long one, in steps by length and tuned for each card shape. 1 is the base size in card.css.
 */
export function cardTextScale(chars: number, size: CardSize): number {
  const steps = size === '1200x675' ? [80, 120, 200, 300] : [80, 150, 260, 400];
  const scales = size === '1200x675' ? [1.25, 1, 0.8, 0.66, 0.56] : [1.5, 1.2, 1, 0.8, 0.62];
  const i = steps.findIndex((limit) => chars <= limit);
  return scales[i === -1 ? scales.length - 1 : i] as number;
}
