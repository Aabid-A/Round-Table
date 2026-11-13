import { SEAT_R, TABLE_Y } from './dimensions.js';

/** How far from the middle the player's eye is, along +z. */
const EYE_Z = SEAT_R + 0.27;

export interface CandleSpot {
  position: [number, number, number];
  height: number;
  /** The cluster it stands in, which shares one light. */
  cluster: number;
}

/**
 * Where the three pairs stand on the table (x, z). Seen from the player's seat each pair falls between two seats, so no candle
 * stands in front of a mask or a name plate.
 */
const CLUSTERS: [number, number][] = [
  [0.867, 0.598],
  [0.41, -0.5],
  [-0.33, 0.1],
];

/** Six candles in three pairs on the table, at different heights so they do not read as a row. */
export const CANDLE_SPOTS: CandleSpot[] = CLUSTERS.flatMap(([cx, cz], cluster) => {
  // The two of a pair stand mostly one behind the other as the player sees them, and a little apart, so the pair stays narrow.
  const d = Math.hypot(cx, EYE_Z - cz);
  const ax = cx / d;
  const az = (cz - EYE_Z) / d;
  // The pair nearest the player has the narrowest gap to stand in, so it stands exactly in line.
  const spread = cluster === 0 ? 0 : 0.045;
  return [-1, 1].map((side, k) => ({
    position: [cx + (ax * 0.09 - az * spread) * side, TABLE_Y, cz + (az * 0.09 + ax * spread) * side] as [number, number, number],
    height: 0.2 + 0.1 * ((cluster + k) % 3),
    cluster,
  }));
});

/** Where each cluster's light sits: over the middle of the pair, at flame height. */
export const CLUSTER_LIGHTS: [number, number, number][] = CLUSTERS.map(([x, z]) => [x, TABLE_Y + 0.42, z]);
