import * as THREE from 'three';

/** A point on a surface made of rings: `v` runs 0 to 1 along it, `theta` once around each ring. */
export type RingFn = (v: number, theta: number) => [number, number, number];
export type RingColour = (v: number, theta: number) => THREE.Color;

/**
 * A closed band of cloth (a cloak, a hood, a sleeve) as one mesh: rings of points joined into triangles, with smooth normals so folds
 * catch the light. The faces are turned to look away from the middle of the rings, whichever way the rings were listed.
 */
export function ringSurface(fn: RingFn, along: number, around: number, colour?: RingColour): THREE.BufferGeometry {
  const positions = new Float32Array((along + 1) * around * 3);
  const colours = colour ? new Float32Array((along + 1) * around * 3) : null;
  for (let i = 0; i <= along; i++) {
    for (let j = 0; j < around; j++) {
      const v = i / along;
      const theta = (j / around) * Math.PI * 2;
      const o = (i * around + j) * 3;
      const p = fn(v, theta);
      positions[o] = p[0];
      positions[o + 1] = p[1];
      positions[o + 2] = p[2];
      if (colours && colour) {
        const c = colour(v, theta);
        colours[o] = c.r;
        colours[o + 1] = c.g;
        colours[o + 2] = c.b;
      }
    }
  }
  const index: number[] = [];
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      const c = a + around;
      const d = b + around;
      index.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (colours) g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  if (facesInward(g, along, around)) {
    for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2]!, index[k + 1]!];
    g.setIndex(index);
    g.computeVertexNormals();
  }
  return g;
}

/** Whether the normals point toward the middle of their own ring, on balance. */
function facesInward(g: THREE.BufferGeometry, along: number, around: number): boolean {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  let sum = 0;
  for (let i = 0; i <= along; i++) {
    const mid = [0, 0, 0];
    for (let j = 0; j < around; j++) {
      const k = i * around + j;
      mid[0]! += pos.getX(k) / around;
      mid[1]! += pos.getY(k) / around;
      mid[2]! += pos.getZ(k) / around;
    }
    for (let j = 0; j < around; j++) {
      const k = i * around + j;
      sum += (pos.getX(k) - mid[0]!) * nor.getX(k) + (pos.getY(k) - mid[1]!) * nor.getY(k) + (pos.getZ(k) - mid[2]!) * nor.getZ(k);
    }
  }
  return sum < 0;
}

/** Rows of numbers at even steps, read at any point between them with a smooth curve through every row (Catmull-Rom). */
export function keyed(rows: number[][]): (v: number) => number[] {
  const n = rows.length - 1;
  return (v) => {
    const t = Math.max(0, Math.min(1, v)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const u = t - i;
    const p0 = rows[Math.max(0, i - 1)]!;
    const p1 = rows[i]!;
    const p2 = rows[i + 1]!;
    const p3 = rows[Math.min(n, i + 2)]!;
    return p1.map((_, k) => 0.5 * (2 * p1[k]! + (p2[k]! - p0[k]!) * u + (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * u * u + (3 * p1[k]! - p0[k]! - 3 * p2[k]! + p3[k]!) * u * u * u));
  };
}

/** Folds in hanging cloth: a few waves around the ring that drift a little down its length, different for each seed, between about -1 and 1. */
export function folds(seed: number): (theta: number, along: number) => number {
  const phase = (k: number): number => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1) * Math.PI * 2;
  return (theta, along) => 0.5 * Math.sin(5 * theta + phase(1) + along * 0.6) + 0.32 * Math.sin(9 * theta + phase(2) - along * 0.9) + 0.18 * Math.sin(14 * theta + phase(3) + along * 1.4);
}
