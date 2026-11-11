import { describe, expect, it } from 'vitest';
import { findHighlights } from '../../src/log/highlights/index.js';
import { renderHighlightsJson, renderHighlightsText } from '../../src/log/highlights/render.js';
import { logFrom, type Spec } from '../helpers/logs.js';

const log = logFrom({ T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful' }, [
  { r: 1, phase: 'recruit_choose', p: 'T1', action: { target: 'F1' } },
  { r: 1, phase: 'recruit_respond', p: 'F1', action: { accept: true }, notes: 'join them' },
  { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F1', accepted: true } },
] as Spec[]);
const items = findHighlights(log, { name: 'g1', base: 'http://localhost:5173/' });

describe('renderHighlightsText', () => {
  it('shows rank, score, title, round, turns, rule and the URLs', () => {
    const text = renderHighlightsText(items);
    expect(text).toContain("#1  [90]  F1 accepts T1's offer and becomes a traitor");
    expect(text).toContain('round 1, turns 0 to 1  (recruit_accepted)');
    expect(text).toContain(`clip:      ${items[0]!.url}`);
    expect(text).toContain(`two faces: ${items[0]!.facesUrl}`);
    expect(text).toContain('#2  [50]  The final reveal');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('says so when there is nothing', () => {
    expect(renderHighlightsText([])).toBe('No highlights found in this game.\n');
  });

  it('leaves out the faces line when the moment has none', () => {
    const text = renderHighlightsText(items.filter((h) => h.rule === 'final_reveal'));
    expect(text).toContain('turns 0 to 1');
    expect(text).not.toContain('two faces');
  });
});

describe('renderHighlightsJson', () => {
  it('is valid JSON that round-trips the list', () => {
    expect(JSON.parse(renderHighlightsJson(items))).toEqual(items);
    expect(JSON.parse(renderHighlightsJson([]))).toEqual([]);
  });
});
