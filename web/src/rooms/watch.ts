import type { GameLog } from '../../../src/engine/types.js';
import type { SpectatorLog } from '../../../server/protocol.js';

/** The partial log, as a log: its result is a placeholder that a live watcher is never shown (Player drops the result step). */
export const asLog = (log: SpectatorLog): GameLog => ({ ...log, result: log.result ?? { winner: null, reason: 'max_rounds', rounds: 0, survivors: [] } });

/** True once there is something to show: nothing is logged until the first round ends. */
export const hasSomethingToShow = (log: SpectatorLog): boolean => log.turns.length > 0 || log.events.length > 0;
