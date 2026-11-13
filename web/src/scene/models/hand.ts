import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type HandPose = 'rest' | 'point';

interface Finger {
  base: [number, number, number];
  spread: number;
  lengths: number[];
  radius: number;
  curl: Record<HandPose, number[]>;
}

// A right hand, life size in metres: the wrist at the origin, fingers along +z, the palm facing down (-y), the thumb toward -x.
const FINGERS: Finger[] = [
  { base: [-0.027, 0, 0.088], spread: -0.14, lengths: [0.04, 0.025, 0.02], radius: 0.0088, curl: { rest: [0.14, 0.24, 0.2], point: [0, 0.04, 0.04] } },
  { base: [-0.009, 0.001, 0.092], spread: -0.03, lengths: [0.044, 0.028, 0.021], radius: 0.009, curl: { rest: [0.16, 0.26, 0.2], point: [1.35, 1.6, 1.1] } },
  { base: [0.009, 0, 0.089], spread: 0.07, lengths: [0.04, 0.026, 0.02], radius: 0.0086, curl: { rest: [0.18, 0.26, 0.2], point: [1.4, 1.6, 1.1] } },
  { base: [0.026, -0.001, 0.08], spread: 0.2, lengths: [0.031, 0.02, 0.017], radius: 0.0076, curl: { rest: [0.2, 0.28, 0.2], point: [1.45, 1.6, 1.1] } },
];
const THUMB: Record<HandPose, { yaw: number; roll: number; curl: number[] }> = {
  rest: { yaw: -0.8, roll: 0.5, curl: [0.1, 0.25] },
  point: { yaw: -0.25, roll: 1.1, curl: [0.55, 0.9] },
};

/** One finger bone: a rounded cylinder from the joint along +z, placed by the joint's matrix. */
function bone(at: THREE.Matrix4, radius: number, length: number): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(radius, length, 3, 7).rotateX(Math.PI / 2).translate(0, 0, length / 2).applyMatrix4(at);
}

/**
 * A shaped hand as one mesh: a palm, a wrist, four fingers of three joints and a thumb of two. At rest the fingers lie a little curled
 * and spread, as on a table; pointing, the first finger is straight and the rest are folded under the thumb.
 */
export function handGeometry(pose: HandPose): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.SphereGeometry(1, 14, 10).scale(0.041, 0.0135, 0.05).translate(0, 0, 0.046));
  parts.push(new THREE.CapsuleGeometry(0.022, 0.05, 3, 10).rotateX(Math.PI / 2).scale(1.15, 0.72, 1).translate(0, 0, -0.022));
  const step = (m: THREE.Matrix4, length: number, curl: number): THREE.Matrix4 => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, length)).multiply(new THREE.Matrix4().makeRotationX(curl));
  for (const f of FINGERS) {
    let m = new THREE.Matrix4().makeTranslation(...f.base).multiply(new THREE.Matrix4().makeRotationY(f.spread)).multiply(new THREE.Matrix4().makeRotationX(f.curl[pose][0]!));
    f.lengths.forEach((length, i) => {
      parts.push(bone(m, f.radius * (1 - i * 0.09), length));
      m = step(m, length, f.curl[pose][i + 1] ?? 0);
    });
  }
  const t = THUMB[pose];
  let m = new THREE.Matrix4().makeTranslation(-0.034, -0.004, 0.02).multiply(new THREE.Matrix4().makeRotationY(t.yaw)).multiply(new THREE.Matrix4().makeRotationZ(t.roll)).multiply(new THREE.Matrix4().makeRotationX(t.curl[0]!));
  [0.036, 0.028].forEach((length, i) => {
    parts.push(bone(m, 0.0105 - i * 0.001, length));
    m = step(m, length, t.curl[i + 1] ?? 0);
  });
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  for (const p of parts) p.dispose();
  merged.deleteAttribute('uv');
  return merged;
}
