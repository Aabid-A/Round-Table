import { useEffect } from 'react';
import type { Action } from './machine.js';
import type { SliceView } from '../scene/sliceView.js';

interface Props {
  view: SliceView;
  dispatch: (a: Action) => void;
  muted: boolean;
  onMute: () => void;
  /** Whether a "skip this" control is useful now (a moment that ends on its own). */
  canSkip: boolean;
}

/**
 * The controls around the room, for everyone: a list of the choosable names as a form (the same choice as pointing in the room),
 * confirm, skip, sound, and the keys. It is also the whole interface of the 2D fallback and the screen-reader path.
 */
export function SliceHud({ view, dispatch, muted, onMute, canSkip }: Props) {
  const choosing = view.choosable.length > 0;
  const names = new Map(view.figures.map((f) => [f.index, f.name]));
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'BUTTON') return;
      if (!choosing) return;
      const i = view.selected === null ? -1 : view.choosable.indexOf(view.selected);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dispatch({ t: 'select', seat: view.choosable[(i + 1) % view.choosable.length]! });
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dispatch({ t: 'select', seat: view.choosable[(i - 1 + view.choosable.length) % view.choosable.length]! });
      else if (e.key === 'Enter' && view.selected !== null) dispatch({ t: 'confirm' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choosing, view.selected, view.choosable, dispatch]);
  return (
    <>
      <div className="slice-bar">
        <button type="button" onClick={onMute} aria-pressed={muted}>{muted ? 'Sound off' : 'Sound on'}</button>
        {canSkip ? <button type="button" onClick={() => dispatch({ t: 'advance' })}>Skip</button> : null}
        {view.announce.startsWith('The slice is over') ? <button type="button" onClick={() => dispatch({ t: 'restart' })}>Sit through it again</button> : null}
      </div>
      {choosing ? (
        <form
          className="slice-choose"
          aria-label="Choose a figure"
          onSubmit={(e) => {
            e.preventDefault();
            if (view.selected !== null) dispatch({ t: 'confirm' });
          }}
        >
          <fieldset>
            <legend>Choose a figure</legend>
            {view.choosable.map((i) => (
              <label key={i} className={view.selected === i ? 'on' : ''}>
                <input type="radio" name="figure" checked={view.selected === i} onChange={() => dispatch({ t: 'select', seat: i })} onFocus={() => dispatch({ t: 'hover', seat: i })} onBlur={() => dispatch({ t: 'hover', seat: null })} />
                {names.get(i)}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={view.selected === null}>Confirm</button>
          <p className="hint">Point at a figure in the room, or use the arrow keys, then Enter.</p>
        </form>
      ) : null}
    </>
  );
}
