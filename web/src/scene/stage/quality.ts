/** Three levels of detail. Low drops shadows and post-processing before it drops geometry (see /scene-3d). */
export type Quality = 'high' | 'medium' | 'low';

export interface QualitySettings {
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  vignette: boolean;
  grain: boolean;
  depthOfField: boolean;
  antialias: boolean;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 2], shadows: true, shadowMapSize: 1024, bloom: true, vignette: true, grain: true, depthOfField: true, antialias: true },
  medium: { dpr: [1, 1.5], shadows: true, shadowMapSize: 512, bloom: true, vignette: true, grain: true, depthOfField: false, antialias: true },
  low: { dpr: [1, 1], shadows: false, shadowMapSize: 256, bloom: false, vignette: true, grain: false, depthOfField: false, antialias: false },
};

/** The slowest a frame may take (ms) to stay at a level: about 40 fps for high, 24 fps for medium. */
export const HIGH_MAX_MS = 25;
export const MEDIUM_MAX_MS = 42;

/** Slower than this (ms, under 10 fps) at the first frames, the machine is too slow for the room: the page shows its plain version. */
export const TOO_SLOW_MS = 100;

/** Whether the first frames say the room is too slow to show at all: their median is over TOO_SLOW_MS. */
export function tooSlow(frameMs: number[]): boolean {
  if (frameMs.length === 0) return false;
  const sorted = [...frameMs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]! > TOO_SLOW_MS;
}

/** Pick a level from frame times measured while the scene runs at high: the median, so one slow frame does not decide. */
export function chooseQuality(frameMs: number[]): Quality {
  if (frameMs.length === 0) return 'medium';
  const sorted = [...frameMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return median <= HIGH_MAX_MS ? 'high' : median <= MEDIUM_MAX_MS ? 'medium' : 'low';
}

/** ?quality=high|medium|low fixes the level (for tests and for a person who wants to choose). */
export function qualityFromSearch(search: string): Quality | null {
  const q = new URLSearchParams(search).get('quality');
  return q === 'high' || q === 'medium' || q === 'low' ? q : null;
}
