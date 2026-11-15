import { AI_NAMES, AI_SEATS } from '../../../src/cast.js';
import type { Role } from '../../../src/types.js';
import { CANDLES, type WorldView } from '../scene/worldView.js';

/**
 * The room before or after a game, with no game in it: the practice AIs in their seats, candles lit, nobody acting. `you` sits the
 * camera in seat 0 (the setup, the end); null lets the title camera drift. `names` replaces the practice AIs' names (the end).
 */
export function hallView(opts: { you: number | null; drift?: boolean; plate?: string | null; names?: string[]; ending?: { seat: number; role: Role }[]; announce?: string }): WorldView {
  const names = opts.names ?? ['', ...AI_NAMES.slice(0, AI_SEATS)];
  return {
    figures: names.map((name, index) => ({ index, name, mask: index, present: true, revealed: null })),
    you: opts.you,
    mood: 'day',
    candlesLit: CANDLES,
    speaker: null,
    speech: null,
    pointing: null,
    looks: names.map(() => null),
    voting: false,
    tokens: [],
    banish: null,
    dawn: null,
    choosable: [],
    hovered: null,
    selected: null,
    caption: '',
    announce: opts.announce ?? '',
    ...(opts.drift ? { drift: true } : {}),
    ...(opts.plate !== undefined ? { plate: opts.plate } : {}),
    ...(opts.ending ? { ending: opts.ending } : {}),
  };
}
