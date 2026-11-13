import { TABLE_Y } from './Table.js';

export interface CandleSpot {
  position: [number, number, number];
  height: number;
  /** The cluster it stands in, which shares one light. */
  cluster: number;
}

const CLUSTER_ANGLES = [Math.PI * 0.18, Math.PI * 0.85, Math.PI * 1.52];
const CLUSTER_R = 0.78;

/** Six candles in three pairs on the table, at different heights so they do not read as a row. */
export const CANDLE_SPOTS: CandleSpot[] = CLUSTER_ANGLES.flatMap((a, cluster) => {
  const cx = Math.sin(a) * CLUSTER_R;
  const cz = Math.cos(a) * CLUSTER_R;
  const tx = Math.cos(a);
  const tz = -Math.sin(a);
  return [-1, 1].map((side, k) => ({
    position: [cx + tx * 0.09 * side, TABLE_Y, cz + tz * 0.09 * side] as [number, number, number],
    height: 0.2 + 0.1 * ((cluster + k) % 3),
    cluster,
  }));
});

/** Where each cluster's light sits: over the middle of the pair, at flame height. */
export const CLUSTER_LIGHTS: [number, number, number][] = CLUSTER_ANGLES.map((a) => [Math.sin(a) * CLUSTER_R, TABLE_Y + 0.42, Math.cos(a) * CLUSTER_R]);
