export const MIN_SPEED = 0.05;
export const MAX_SPEED = 100;

export type Aspect = '16x9' | '9x16';

export interface RecordParams {
  aspect: Aspect;
  /** First and last turn id of the clip, inclusive. Both absent means the whole episode. */
  from: number | null;
  to: number | null;
  /** Show the "two faces" shot for this one turn instead of playing. */
  faces: number | null;
  /** Pacing multiplier: 2 plays twice as fast. Between MIN_SPEED and MAX_SPEED. */
  speed: number;
  /** Seats to film from instead of the public table: one for a single view, two for a split view. Null for the public table. */
  seats: string[] | null;
  /** Film the all-seeing room with the director's camera. Shows every role, note and whisper: for replays and published episodes only. */
  spectator: boolean;
}

export type RecordParse = { ok: true; params: RecordParams } | { ok: false; message: string };

export const isRecordMode = (search: string): boolean => new URLSearchParams(search).get('mode') === 'record';

function wholeNumber(q: URLSearchParams, key: string): number | null | 'bad' {
  const v = q.get(key);
  if (v === null) return null;
  return /^\d{1,9}$/.test(v) ? Number(v) : 'bad';
}

/** Read ?mode=record&aspect=9x16&from=3&to=9&faces=7&speed=2. Says which parameter is wrong. */
export function parseRecordParams(search: string): RecordParse {
  const q = new URLSearchParams(search);
  const aspect = q.get('aspect') ?? '16x9';
  if (aspect !== '16x9' && aspect !== '9x16') return { ok: false, message: `aspect must be 16x9 or 9x16, not "${aspect}".` };
  const from = wholeNumber(q, 'from');
  const to = wholeNumber(q, 'to');
  const faces = wholeNumber(q, 'faces');
  for (const [key, v] of [['from', from], ['to', to], ['faces', faces]] as const) {
    if (v === 'bad') return { ok: false, message: `${key} must be a turn id (a whole number).` };
  }
  if (from !== null && to !== null && from !== 'bad' && to !== 'bad' && to < from) {
    return { ok: false, message: `to (${to}) comes before from (${from}).` };
  }
  const speedText = q.get('speed');
  const speed = speedText === null ? 1 : Number(speedText);
  if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) {
    return { ok: false, message: `speed must be a number from ${MIN_SPEED} to ${MAX_SPEED}.` };
  }
  const seats = parseSeats(q);
  if (typeof seats === 'string') return { ok: false, message: seats };
  const view = q.get('view');
  if (view !== null && view !== 'spectator') return { ok: false, message: `view must be spectator, not "${view}".` };
  if (view === 'spectator' && seats !== null) return { ok: false, message: 'Use view=spectator or seat/seats, not both.' };
  return { ok: true, params: { aspect, from: from as number | null, to: to as number | null, faces: faces as number | null, speed, seats, spectator: view === 'spectator' } };
}

/** ?seat=Aria for one seat, ?seats=Aria,Bram for a split view. Names are checked against the cast when the log is loaded. */
function parseSeats(q: URLSearchParams): string[] | null | string {
  const one = q.get('seat');
  const two = q.get('seats');
  if (one !== null && two !== null) return 'Use seat for one seat or seats for two, not both.';
  if (one !== null) return one === '' ? 'seat needs a name.' : [one];
  if (two === null) return null;
  const names = two.split(',');
  if (names.length !== 2 || names.some((n) => n === '')) return 'seats needs two names with a comma between them, like seats=Aria,Bram.';
  if (names[0] === names[1]) return 'seats needs two different seats.';
  return names;
}
