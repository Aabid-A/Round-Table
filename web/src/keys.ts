export type Action = 'next' | 'prev' | 'toggle' | 'spectate';

export interface KeyTarget {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

/**
 * Which playback action a key press means, or null to leave it to the browser.
 * Arrows step except on the scrubber (they move it natively); space plays or
 * pauses except on buttons and checkboxes (it activates them natively); `a` goes to
 * the all-seeing view when the page asks for it (the replay page does; the guess page must not); nothing fires while typing in a text field.
 */
export function actionForKey(key: string, target: KeyTarget | null, options: { spectate?: boolean } = {}): Action | null {
  const tag = target?.tagName ?? '';
  const type = (target?.type ?? '').toLowerCase();
  const typing = tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true || (tag === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'file'].includes(type));
  if (typing) return null;
  const onScrubber = tag === 'INPUT' && type === 'range';
  if (key === 'ArrowRight') return onScrubber ? null : 'next';
  if (key === 'ArrowLeft') return onScrubber ? null : 'prev';
  if ((key === 'a' || key === 'A') && options.spectate === true) return 'spectate'; // only the replay page has the all-seeing room
  if (key === ' ') {
    const activates = tag === 'BUTTON' || tag === 'A' || (tag === 'INPUT' && ['checkbox', 'radio', 'button', 'file'].includes(type));
    return activates ? null : 'toggle';
  }
  return null;
}
