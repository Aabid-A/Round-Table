export type Aspect = '16x9' | '9x16';

export interface RecordParams {
  aspect: Aspect;
  /** First and last turn id of the clip, inclusive. Both absent means the whole episode. */
  from: number | null;
  to: number | null;
  /** Show the "two faces" shot for this one turn instead of playing. */
  faces: number | null;
  /** Pacing multiplier: 2 plays twice as fast. */
  speed: number;
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
  if (!Number.isFinite(speed) || speed <= 0 || speed > 100) return { ok: false, message: 'speed must be a number above 0 and up to 100.' };
  return { ok: true, params: { aspect, from: from as number | null, to: to as number | null, faces: faces as number | null, speed } };
}
