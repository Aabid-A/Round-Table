import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { folds, keyed, ringSurface } from './cloth.js';

/** Heights of a seated figure, in metres from the floor. */
export const HIP_Y = 0.56;
export const SHOULDER_Y = 1.08;
export const HEAD_Y = 1.34;

// Each row: height, half-width, half-depth, how far forward the ring's middle sits, and how deep the folds are there.
const CLOAK_ROWS = [
  [0.03, 0.34, 0.31, 0.3, 0.05],
  [0.26, 0.31, 0.28, 0.3, 0.042],
  [0.49, 0.3, 0.28, 0.26, 0.03],
  [0.6, 0.3, 0.36, 0.14, 0.02],
  [0.74, 0.27, 0.23, 0.03, 0.03],
  [0.95, 0.28, 0.21, 0.0, 0.022],
  [SHOULDER_Y, 0.3, 0.19, 0.0, 0.006],
  [1.17, 0.21, 0.16, 0.0, 0.0],
  [1.23, 0.1, 0.1, -0.01, 0.0],
];

/**
 * The cloak of a seated figure, as one draped surface: it hangs from the shoulders, lies over the lap and knees and falls to the floor,
 * with folds that deepen toward the hem. The arms are inside it. A thin line of the wearer's colour runs down the front edge.
 */
export function cloakGeometry(seed: number, accent: string): THREE.BufferGeometry {
  const row = keyed(CLOAK_ROWS);
  const fold = folds(seed);
  const cloth = new THREE.Color(PALETTE.robe);
  const trim = new THREE.Color(accent).multiplyScalar(0.7);
  const front = Math.PI / 2 + 0.16;
  const edge = (theta: number): number => Math.exp(-(((theta - front) / 0.07) ** 2));
  return ringSurface(
    (v, theta) => {
      const [y, rx, rz, cz, depth] = row(v) as [number, number, number, number, number];
      // The front edge of the cloak laps over itself: a small raised ridge beside the middle.
      const k = 1 + depth * 3.2 * fold(theta, y * 4) * (1 / Math.max(rx, 0.1)) * 0.3 + 0.03 * edge(theta) * Math.min(1, depth * 60);
      return [Math.cos(theta) * rx * k, y, cz + Math.sin(theta) * rz * k];
    },
    30,
    56,
    (v, theta) => (v > 0.04 && v < 0.82 && edge(theta) > 0.55 ? trim : cloth),
  );
}

const MANTLE_ROWS = [
  [1.27, 0.1, 0.1, 0.0, 0.0],
  [1.2, 0.23, 0.18, 0.0, 0.004],
  [1.12, 0.355, 0.235, 0.0, 0.012],
  [1.0, 0.37, 0.26, 0.005, 0.045],
  [0.9, 0.385, 0.285, 0.01, 0.075],
];

/** A short cape over the shoulders, which gives the figure its shoulders and a second layer of cloth. Its hem carries the wearer's colour. */
export function mantleGeometry(seed: number, accent: string): THREE.BufferGeometry {
  const row = keyed(MANTLE_ROWS);
  const fold = folds(seed + 40);
  const cloth = new THREE.Color(PALETTE.mantle);
  const trim = new THREE.Color(accent).multiplyScalar(0.55);
  return ringSurface(
    (v, theta) => {
      const [y, rx, rz, cz, depth] = row(v) as [number, number, number, number, number];
      const f = fold(theta, 0);
      const k = 1 + (depth * f) / 0.3;
      // The hem rises and falls with the folds, so it is not a ruled line.
      return [Math.cos(theta) * rx * k, y - v * v * 0.025 * f, cz + Math.sin(theta) * rz * k];
    },
    14,
    56,
    (v) => (v > 0.86 ? trim : cloth),
  );
}

// Each row: how far forward the ring is, half-width, half-height above its middle, half-height below it, and the height of its middle.
const HOOD_ROWS = [
  [0.07, 0.15, 0.2, 0.22, 0.01],
  [0.14, 0.162, 0.215, 0.24, 0.012],
  [0.185, 0.185, 0.245, 0.27, 0.015],
  [0.11, 0.222, 0.275, 0.3, 0.02],
  [-0.03, 0.238, 0.285, 0.31, 0.02],
  [-0.17, 0.2, 0.255, 0.29, 0.0],
  [-0.27, 0.11, 0.15, 0.2, -0.05],
  [-0.31, 0.0, 0.0, 0.0, -0.1],
];

/**
 * A deep hood around a head at the origin, looking along +z. It is a cowl with thickness: the cloth turns in at the rim, the top of the
 * rim hangs forward over the brow, the sides drape down to the shoulders and the back comes to a soft point.
 */
export function hoodGeometry(seed: number): THREE.BufferGeometry {
  const row = keyed(HOOD_ROWS);
  const fold = folds(seed + 80);
  return ringSurface(
    (v, theta) => {
      const [z, rx, up, down, cy] = row(v) as [number, number, number, number, number];
      const s = Math.sin(theta);
      const c = Math.cos(theta);
      const rim = Math.max(0, 1 - Math.abs(v - 0.28) * 4);
      const wrinkle = 1 + 0.02 * fold(theta, v * 3) * (v > 0.3 ? 1 : 0);
      const y = cy + (s > 0 ? up * s + 0.04 * s * s * s : down * s);
      // Wider toward the bottom, where it lies on the shoulders; the brow of the rim leans forward and the chin of it falls back.
      const x = c * rx * (1 + (s < 0 ? -0.22 * s : 0)) * wrinkle;
      return [x, y * wrinkle, z + rim * (s > 0 ? 0.05 * s : 0.07 * s)];
    },
    28,
    40,
  );
}

/** A wide sleeve along +z from the shoulder at the origin to an open cuff, hanging lower underneath. The cuff carries the wearer's colour. */
export function sleeveGeometry(length: number, accent: string, cuff = 0.07): THREE.BufferGeometry {
  const cloth = new THREE.Color(PALETTE.robe);
  const trim = new THREE.Color(accent).multiplyScalar(0.85);
  const row = keyed([
    [0, 0.085, 0],
    [0.5, 0.075, 0.012],
    [0.86, cuff, 0.03],
    [1, cuff * 1.12, 0.045],
    [0.93, cuff * 0.8, 0.03],
  ]);
  const fold = folds(7);
  return ringSurface(
    (v, theta) => {
      const [t, r, sag] = row(v) as [number, number, number];
      const s = Math.sin(theta);
      const k = 1 + 0.05 * fold(theta, t * 3) * t;
      return [Math.cos(theta) * r * k, s * r * k * (s < 0 ? 1 + sag / r : 0.9), t * length];
    },
    16,
    20,
    (v) => (v > 0.6 && v < 0.82 ? trim : cloth),
  );
}
