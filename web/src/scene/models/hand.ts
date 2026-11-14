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

// A left hand, life size in metres (a right hand is its mirror image): the wrist at the origin, fingers along +z, the palm facing down (-y), the thumb toward -x.
// The fingers lie close together, a hair apart so each reads, and fan only a little; at rest they arch, knuckles up and tips down on the wood, so from above each finger shows as its own curve.
const FINGERS: Finger[] = [
  { base: [-0.026, 0, 0.088], spread: -0.08, lengths: [0.04, 0.025, 0.021], radius: 0.0082, curl: { rest: [0.26, 0.4, 0.28], point: [0, 0.04, 0.04] } },
  { base: [-0.0085, 0.001, 0.092], spread: -0.02, lengths: [0.044, 0.028, 0.022], radius: 0.0084, curl: { rest: [0.28, 0.42, 0.28], point: [1.35, 1.6, 1.1] } },
  { base: [0.0085, 0, 0.089], spread: 0.03, lengths: [0.04, 0.026, 0.021], radius: 0.008, curl: { rest: [0.3, 0.42, 0.28], point: [1.4, 1.6, 1.1] } },
  { base: [0.025, -0.001, 0.08], spread: 0.1, lengths: [0.031, 0.02, 0.018], radius: 0.007, curl: { rest: [0.33, 0.44, 0.28], point: [1.45, 1.6, 1.1] } },
];
const THUMB: Record<HandPose, { yaw: number; roll: number; curl: number[] }> = {
  rest: { yaw: -0.7, roll: 0.5, curl: [0.12, 0.3] },
  point: { yaw: -0.25, roll: 1.1, curl: [0.55, 0.9] },
};
/** Fingers are a little flatter than they are wide. */
const FLAT = 0.8;

/**
 * The outline of one finger bone, turned on a lathe: it swells at the joint it starts from, narrows in the middle and swells again at
 * the next joint. The last bone of a finger tapers to a rounded tip instead.
 */
export function boneProfile(radius: number, length: number, tip: boolean): [number, number][] {
  const r = radius;
  const start: [number, number][] = [[0, -r * 0.5], [r * 0.72, -r * 0.36], [r * 1.0, 0], [r * 0.84, length * 0.5]];
  const end: [number, number][] = tip
    ? [[r * 0.8, length * 0.78], [r * 0.58, length + r * 0.15], [r * 0.28, length + r * 0.42], [0, length + r * 0.5]]
    : [[r * 0.95, length - r * 0.1], [r * 0.68, length + r * 0.36], [0, length + r * 0.5]];
  return [...start, ...end];
}

/** One finger bone placed by its joint's matrix: lathed along +z and flattened, with a nail on the back of a tip. */
function bone(at: THREE.Matrix4, radius: number, length: number, tip: boolean): THREE.BufferGeometry[] {
  const shaft = new THREE.LatheGeometry(boneProfile(radius, length, tip).map(([x, y]) => new THREE.Vector2(x, y)), 9).rotateX(Math.PI / 2).scale(1, FLAT, 1);
  const parts: THREE.BufferGeometry[] = [shaft];
  // The nail is on the back of the hand, which faces up (+y) since the palm faces down.
  if (tip) parts.push(new THREE.SphereGeometry(1, 8, 5).scale(radius * 0.68, radius * 0.22, radius * 0.95).translate(0, radius * FLAT * 0.78, length * 0.62));
  return parts.map((p) => p.applyMatrix4(at));
}

/**
 * A shaped hand as one mesh: a palm with a ridge of knuckles, a wrist, four fingers of three joints and a thumb of two, each finger
 * waisted between its joints and tapering to a nailed tip. At rest the fingers lie close together and curled, as on a table; pointing, the first finger is straight and the rest are folded under the thumb.
 */
export function handGeometry(pose: HandPose): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.SphereGeometry(1, 14, 10).scale(0.041, 0.0135, 0.05).translate(0, 0, 0.046));
  // The knuckles: a low ridge across the back of the hand where the fingers start.
  parts.push(new THREE.CapsuleGeometry(0.011, 0.04, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.85, 1).translate(0, 0.003, 0.083));
  parts.push(new THREE.CapsuleGeometry(0.022, 0.05, 3, 10).rotateX(Math.PI / 2).scale(1.15, 0.72, 1).translate(0, 0, -0.022));
  const step = (m: THREE.Matrix4, length: number, curl: number): THREE.Matrix4 => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, length)).multiply(new THREE.Matrix4().makeRotationX(curl));
  for (const f of FINGERS) {
    let m = new THREE.Matrix4().makeTranslation(...f.base).multiply(new THREE.Matrix4().makeRotationY(f.spread)).multiply(new THREE.Matrix4().makeRotationX(f.curl[pose][0]!));
    f.lengths.forEach((length, i) => {
      parts.push(...bone(m, f.radius * (1 - i * 0.1), length, i === f.lengths.length - 1));
      m = step(m, length, f.curl[pose][i + 1] ?? 0);
    });
  }
  const t = THUMB[pose];
  let m = new THREE.Matrix4().makeTranslation(-0.034, -0.004, 0.02).multiply(new THREE.Matrix4().makeRotationY(t.yaw)).multiply(new THREE.Matrix4().makeRotationZ(t.roll)).multiply(new THREE.Matrix4().makeRotationX(t.curl[0]!));
  [0.036, 0.028].forEach((length, i) => {
    parts.push(...bone(m, 0.0105 - i * 0.001, length, i === 1));
    m = step(m, length, t.curl[i + 1] ?? 0);
  });
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  for (const p of parts) p.dispose();
  merged.deleteAttribute('uv');
  return merged;
}
