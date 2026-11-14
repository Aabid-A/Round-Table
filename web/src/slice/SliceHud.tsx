import { useState } from 'react';
import { ChooseList, useChooseKeys } from '../scene/Choose.js';
import type { Action } from './machine.js';
import type { InputKind } from '../scene/prompts.js';
import type { WorldView } from '../scene/world.js';

interface Props {
  view: WorldView;
  dispatch: (a: Action) => void;
  muted: boolean;
  onMute: () => void;
  /** Whether a "skip this" control is useful now (a moment that ends on its own). */
  canSkip: boolean;
  /** The slice is over: offer to sit through it again. */
  ended: boolean;
  /** Start with the list of names open (the plain version, which has no room to choose in). */
  listOpen?: boolean;
  /** Touch or keys: a touch screen is not told about arrow keys. */
  input?: InputKind;
}

/**
 * The controls around the room. The choice itself is made in the room, by looking at a figure and selecting it; here are the keys
 * (arrows to choose, Enter to confirm) and, folded away, the same choice as a list for a screen reader or anyone who prefers one.
 * It is also the whole interface of the plain version, where the list starts open.
 */
export function SliceHud({ view, dispatch, muted, onMute, canSkip, ended, listOpen = false, input = 'keys' }: Props) {
  const names = new Map(view.figures.map((f) => [f.index, f.name]));
  const select = (seat: number): void => dispatch({ t: 'select', seat });
  const confirm = (): void => dispatch({ t: 'confirm' });
  useChooseKeys(view.choosable, view.selected, select, confirm);
  // Once opened, the list stays open for the next choice too, until the player folds it away.
  const [open, setOpen] = useState(listOpen);
  return (
    <>
      <div className="scene-bar">
        <button type="button" onClick={onMute} aria-pressed={muted}>{muted ? 'Sound off' : 'Sound on'}</button>
        {canSkip ? <button type="button" onClick={() => dispatch({ t: 'advance' })}>Skip</button> : null}
        {ended ? <button type="button" onClick={() => dispatch({ t: 'restart' })}>Sit through it again</button> : null}
      </div>
      {view.choosable.length > 0 ? (
        <ChooseList options={view.choosable.map((seat) => ({ seat, name: names.get(seat) ?? '' }))} selected={view.selected} onSelect={select} onConfirm={confirm} onHover={(seat) => dispatch({ t: 'hover', seat })} input={input} open={open || listOpen} onOpen={setOpen} />
      ) : null}
    </>
  );
}
