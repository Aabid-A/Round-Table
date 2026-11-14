import type { Cue } from '../scene/cue.js';
import type { Stage } from './machine.js';

export type { Cue };

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
