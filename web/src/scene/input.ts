import { useEffect, useState } from 'react';
import type { InputKind } from './prompts.js';

const coarse = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Whether the player is using touch or a pointer and keys: a coarse pointer to begin with, then whatever they last used, so a
 * tablet with a keyboard is told about keys once a key is pressed and a laptop with a touch screen is told to tap once it is touched.
 */
export function useInputKind(): InputKind {
  const [kind, setKind] = useState<InputKind>(() => (coarse() ? 'touch' : 'keys'));
  useEffect(() => {
    const onPointer = (e: PointerEvent): void => setKind(e.pointerType === 'touch' ? 'touch' : 'keys');
    const onKey = (): void => setKind('keys');
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);
  return kind;
}
