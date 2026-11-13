import type { Stage } from './machine.js';

/** The sound effects of the slice. Each is synthesised in sound.ts; there are no voices and no recorded audio. */
export type Cue = 'chair' | 'point' | 'token' | 'mask' | 'snuff' | 'dawn' | 'select' | 'confirm';

/** Which sound a change of stage makes, so a moment is heard as well as seen. */
export function cueForStage(stage: Stage): Cue | null {
  switch (stage.kind) {
    case 'pointed': return 'point';
    case 'tally': return 'token';
    case 'banish': return stage.step === 'pushback' ? 'chair' : stage.step === 'mask' ? 'mask' : null;
    case 'night': return 'snuff';
    case 'dawn': return 'dawn';
    default: return null;
  }
}
