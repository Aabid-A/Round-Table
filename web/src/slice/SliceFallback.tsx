import { MASKS } from '../scene/models/masks.js';
import type { SliceView } from '../scene/sliceView.js';

/** The same moment as plain markup, for a browser without WebGL or a person who asks for it (?fallback=1): who is at the table, and what is happening. */
export function SliceFallback({ view, reason }: { view: SliceView; reason: string }) {
  return (
    <div className="slice-fallback" data-testid="slice-fallback">
      <h1>Round table</h1>
      <p className="hint">{reason}</p>
      <ul aria-label="At the table">
        {view.figures.map((f) => (
          <li key={f.index} className={f.present ? '' : 'out'}>
            <span className="swatch" style={{ background: MASKS[f.index]!.colour }} aria-hidden="true" />
            {f.name}{f.index === view.you ? ' (you)' : ''}{f.present ? '' : ' (gone)'}{f.revealed ? `, was a ${f.revealed}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
