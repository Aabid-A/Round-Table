import { useEffect, useRef } from 'react';
import type { InputKind } from './prompts.js';

export interface ChooseOption {
  seat: number;
  name: string;
}

interface Props {
  options: ChooseOption[];
  selected: number | null;
  onSelect: (seat: number) => void;
  onConfirm: () => void;
  /** The list's focus is the room's hover, so the figure lifts as its name is reached. */
  onHover?: (seat: number | null) => void;
  input?: InputKind;
  /** Whether the list is unfolded. Kept by the caller, which outlives one choice, so a list once opened stays open for the next. */
  open: boolean;
  onOpen: (open: boolean) => void;
  legend?: string;
}

/**
 * The keys for choosing a figure in the room: the arrows move the choice round the seats that may be chosen, Enter confirms it. Keys
 * pressed in a form control are left alone. The keys read the newest choice, so two quick presses are never judged against an old one.
 */
export function useChooseKeys(choosable: number[], selected: number | null, onSelect: (seat: number) => void, onConfirm: () => void): void {
  const latest = useRef({ choosable, selected, onSelect, onConfirm });
  latest.current = { choosable, selected, onSelect, onConfirm };
  const active = choosable.length > 0;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const { choosable: c, selected: s, onSelect: pick, onConfirm: ok } = latest.current;
      const i = s === null ? -1 : c.indexOf(s);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pick(c[(i + 1) % c.length]!);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') pick(c[(i - 1 + c.length) % c.length]!);
      else if (e.key === 'Enter' && s !== null) ok();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

/**
 * The same choice as a list, folded away beside the room, for a screen reader or anyone who prefers one.
 */
export function ChooseList({ options, selected, onSelect, onConfirm, onHover, input = 'keys', open, onOpen, legend = 'Choose a figure' }: Props) {
  return (
    <details className="scene-choose" open={open} onToggle={(e) => onOpen(e.currentTarget.open)}>
      <summary>Choose from a list</summary>
      <form
        aria-label={legend}
        onSubmit={(e) => {
          e.preventDefault();
          if (selected !== null) onConfirm();
        }}
      >
        <fieldset>
          <legend>{legend}</legend>
          {options.map(({ seat, name }) => (
            <label key={seat} className={selected === seat ? 'on' : ''}>
              <input type="radio" name="figure" checked={selected === seat} onChange={() => onSelect(seat)} onFocus={() => onHover?.(seat)} onBlur={() => onHover?.(null)} />
              {name}
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={selected === null}>Confirm</button>
        {input === 'keys' ? <p className="hint">Or use the arrow keys to choose, then Enter.</p> : null}
      </form>
    </details>
  );
}
