import type { RankedHighlight } from './types.js';

/** Plain text for a person: one block per highlight, best first. */
export function renderHighlightsText(items: RankedHighlight[]): string {
  if (items.length === 0) return 'No highlights found in this game.\n';
  const lines: string[] = [];
  for (const h of items) {
    lines.push(`#${h.rank}  [${h.score}]  ${h.title}`);
    lines.push(`    round ${h.round}, turns ${h.from === h.to ? h.from : `${h.from} to ${h.to}`}  (${h.rule})`);
    lines.push(`    clip:      ${h.url}`);
    if (h.facesUrl) lines.push(`    two faces: ${h.facesUrl}`);
  }
  return `${lines.join('\n')}\n`;
}

/** JSON for tools: the same list, pretty-printed. */
export function renderHighlightsJson(items: RankedHighlight[]): string {
  return `${JSON.stringify(items, null, 2)}\n`;
}
