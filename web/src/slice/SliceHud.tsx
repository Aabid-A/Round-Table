import { useEffect, useRef } from 'react';
import type { Action } from './machine.js';
import type { SliceView } from '../scene/sliceView.js';

interface Props {
  view: SliceView;
  dispatch: (a: Action) => void;
  muted: boolean;
  onMute: () => void;
  /** Whether a "skip this" control is useful now (a moment that ends on its own). */
  canSkip: boolean;
  /** The slice is over: offer to sit through it again. */
  ended: boolean;
  /** Start with the list of names open (the plain version, which has no room to choose in). */
  listOpen?: boolean;
}

/**
 * The controls around the room. The choice itself is made in the room, by looking at a figure and selecting it; here are the keys
 * (arrows to choose, Enter to confirm) and, folded away, the same choice as a list for a screen reader or anyone who prefers one.
 * It is also the whole interface of the plain version, where the list starts open.
 */
export function SliceHud({ view, dispatch, muted, onMute, canSkip, ended, listOpen = false }: Props) {
  const choosing = view.choosable.length > 0;
  const names = new Map(view.figures.map((f) => [f.index, f.name]));
  // The keys read the newest view, so two quick presses are never judged against an old choice.
  const latest = useRef(view);
  latest.current = view;
  useEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SUMMARY') return;
      const { selected, choosable } = latest.current;
      const i = selected === null ? -1 : choosable.indexOf(selected);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dispatch({ t: 'select', seat: choosable[(i + 1) % choosable.length]! });
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dispatch({ t: 'select', seat: choosable[(i - 1 + choosable.length) % choosable.length]! });
      else if (e.key === 'Enter' && selected !== null) dispatch({ t: 'confirm' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choosing, dispatch]);
  return (
    <>
      <div className="slice-bar">
        <button type="button" onClick={onMute} aria-pressed={muted}>{muted ? 'Sound off' : 'Sound on'}</button>
        {canSkip ? <button type="button" onClick={() => dispatch({ t: 'advance' })}>Skip</button> : null}
        {ended ? <button type="button" onClick={() => dispatch({ t: 'restart' })}>Sit through it again</button> : null}
      </div>
      {choosing ? (
        <details className="slice-choose" open={listOpen || undefined}>
          <summary>Choose from a list</summary>
          <form
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
            <p className="hint">Or use the arrow keys to choose, then Enter.</p>
          </form>
        </details>
      ) : null}
    </>
  );
}
