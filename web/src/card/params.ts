export const CARD_SIZES = ['1200x675', '1080x1350'] as const;
export type CardSize = (typeof CARD_SIZES)[number];

/** Pixel size of a card, from its size name. */
export function cardPixels(size: CardSize): { width: number; height: number } {
  const [width, height] = size.split('x').map(Number) as [number, number];
  return { width, height };
}

export interface CardParams {
  /** The turn id of the quote. */
  turn: number;
  size: CardSize;
  /** The log's name in web/public/games/. */
  log: string;
}

export type CardParse = { ok: true; params: CardParams } | { ok: false; message: string };

export const isCardPage = (search: string): boolean => new URLSearchParams(search).has('card');

/** Read ?card=<turnId>&log=<name>&size=1200x675|1080x1350. Says which parameter is wrong. */
export function parseCardParams(search: string): CardParse {
  const q = new URLSearchParams(search);
  const turn = q.get('card') ?? '';
  if (!/^\d{1,9}$/.test(turn)) return { ok: false, message: 'card must be a turn id (a whole number).' };
  const log = q.get('log');
  if (log === null || log === '') return { ok: false, message: 'A card needs ?log=<name> for a file in web/public/games/.' };
  if (!/^[\w.-]+$/.test(log) || log.includes('..')) return { ok: false, message: 'log must be a plain file name (letters, digits, dot, dash, underscore).' };
  const size = q.get('size') ?? CARD_SIZES[0];
  if (!(CARD_SIZES as readonly string[]).includes(size)) return { ok: false, message: `size must be ${CARD_SIZES.join(' or ')}, not "${size}".` };
  return { ok: true, params: { turn: Number(turn), size: size as CardSize, log } };
}
