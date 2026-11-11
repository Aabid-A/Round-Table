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

/** How much to shrink quote text so it fits its panel: steps by length, tuned for each card shape. */
export function cardTextScale(chars: number, size: CardSize): number {
  const steps = size === '1200x675' ? [120, 200, 300] : [150, 260, 400];
  const scales = [1, 0.8, 0.66, 0.56];
  const i = steps.findIndex((limit) => chars <= limit);
  return i === -1 ? (scales[3] as number) : (scales[i] as number);
}
