import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../palette.js';
import { maskOutline, outlineRadius, type Emblem, type MaskDesign } from './masks.js';

/** How thick a mask is, in its own units (a mask is about two units tall). */
export const MASK_THICKNESS = 0.09;
const RINGS = 10;
const EYE_Y = 0.1;
const BROW_Y = 0.52;

const bell = (d: number, w: number): number => Math.exp(-((d / w) ** 2));

/**
 * The sculpted face of a mask: how far forward its surface stands at a point. It curves round the face from side to side and a little
 * from brow to chin, with a brow ridge, a nose that runs down to a tip, and two hollows where the eyes are set.
 */
export function maskHeight(x: number, y: number, eyes = 0.27): number {
  const curve = 0.36 * (1 - (x / 0.92) ** 2) - 0.09 * y * y;
  const nose = 0.15 * bell(x, 0.1) * bell(y + 0.2, 0.24) + 0.04 * bell(x, 0.2) * bell(y + 0.3, 0.12);
  const brow = 0.05 * bell(y - 0.29, 0.1) * (1 - bell(x, 0.1)) * bell(x, 0.62);
  const sockets = 0.075 * (bell(x - eyes, 0.18) + bell(x + eyes, 0.18)) * bell(y - EYE_Y, 0.11);
  return curve + nose + brow - sockets;
}

/** The directions a mask's surface is sampled in: evenly round, plus one at every corner of the outline so points stay sharp. */
function directions(outline: [number, number][]): number[] {
  const even = Array.from({ length: 72 }, (_, i) => (i / 72) * Math.PI * 2);
  const corners = outline.map(([x, y]) => (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2));
  const all = [...even, ...corners].sort((a, b) => a - b);
  return all.filter((a, i) => i === 0 || a - all[i - 1]! > 1e-4);
}

function emblemShape(e: Emblem): THREE.Shape[] {
  const s = new THREE.Shape();
  const disc = (x: number): THREE.Shape => new THREE.Shape().absarc(x, 0, 0.055, 0, Math.PI * 2, false) as THREE.Shape;
  switch (e) {
    case 'star':
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.07 : 0.17;
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      return [s];
    case 'ring':
      s.absarc(0, 0, 0.16, 0, Math.PI * 2, false);
      s.holes.push(new THREE.Path().absarc(0, 0, 0.085, 0, Math.PI * 2, true));
      return [s];
    case 'bar':
      s.moveTo(-0.22, -0.045); s.lineTo(0.22, -0.045); s.lineTo(0.22, 0.045); s.lineTo(-0.22, 0.045);
      return [s];
    case 'dots':
      return [disc(-0.14), disc(0), disc(0.14)];
    case 'cross':
      [[-0.045, -0.17], [0.045, -0.17], [0.045, -0.045], [0.17, -0.045], [0.17, 0.045], [0.045, 0.045], [0.045, 0.17], [-0.045, 0.17], [-0.045, 0.045], [-0.17, 0.045], [-0.17, -0.045], [-0.045, -0.045]].forEach(([x, y], i) => (i ? s.lineTo(x!, y!) : s.moveTo(x!, y!)));
      return [s];
    case 'drop':
      s.moveTo(0, 0.18); s.quadraticCurveTo(0.16, -0.02, 0.1, -0.1); s.quadraticCurveTo(0, -0.2, -0.1, -0.1); s.quadraticCurveTo(-0.16, -0.02, 0, 0.18);
      return [s];
    case 'wave':
      s.moveTo(-0.22, -0.02); s.quadraticCurveTo(-0.11, 0.12, 0, -0.02); s.quadraticCurveTo(0.11, -0.16, 0.22, -0.02); s.lineTo(0.22, 0.06); s.quadraticCurveTo(0.11, -0.08, 0, 0.06); s.quadraticCurveTo(-0.11, 0.2, -0.22, 0.06);
      return [s];
    case 'tri':
      s.moveTo(0, 0.17); s.lineTo(0.17, -0.12); s.lineTo(-0.17, -0.12);
      return [s];
  }
}

function paint(g: THREE.BufferGeometry, colour: THREE.Color): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colour.toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

/** The front, back or both skins of a mask as a grid of rings from the middle out to the outline. */
function skin(design: MaskDesign, side: 'shell' | 'lining'): THREE.BufferGeometry {
  const outline = maskOutline(design.shape);
  const dirs = directions(outline);
  const n = dirs.length;
  const accent = new THREE.Color(design.colour);
  // The whole face leans toward the wearer's colour, lighter or darker by design; the rim is the colour itself.
  const bone = new THREE.Color(PALETTE.bone).lerp(accent, design.tint).multiplyScalar(design.shade);
  const inside = new THREE.Color(PALETTE.boneShade).multiplyScalar(0.35);
  const positions: number[] = [];
  const colours: number[] = [];
  const index: number[] = [];
  const layer = (back: boolean): number => {
    const start = positions.length / 3;
    for (let k = 0; k <= RINGS; k++) {
      const s = (k / RINGS) ** 0.85;
      for (const a of dirs) {
        const r = outlineRadius(outline, a) * s;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        // The edge rolls back a little, so the rim is rounded and not a knife.
        const z = maskHeight(x, y, design.eyes) - 0.05 * s ** 8 - (back ? MASK_THICKNESS * (1 - 0.5 * s ** 6) : 0);
        positions.push(x, y, z);
        // A band of the wearer's colour round the rim: the colour is read after the shape, from the same silhouette.
        (back ? inside : s > 0.8 ? accent : bone).toArray(colours, colours.length);
      }
    }
    for (let k = 0; k < RINGS; k++) {
      for (let j = 0; j < n; j++) {
        const a = start + k * n + j;
        const b = start + k * n + ((j + 1) % n);
        const c = a + n;
        const d = b + n;
        if (back) index.push(a, b, c, b, d, c);
        else index.push(a, c, b, b, c, d);
      }
    }
    return start;
  };
  if (side === 'lining') {
    layer(true);
  } else {
    const front = layer(false);
    const back = layer(true);
    // The wall of the rim, joining the two skins.
    for (let j = 0; j < n; j++) {
      const a = front + RINGS * n + j;
      const b = front + RINGS * n + ((j + 1) % n);
      const c = back + RINGS * n + j;
      const d = back + RINGS * n + ((j + 1) % n);
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A whole mask as one solid mesh: a curved, sculpted face with thickness in its seat's own outline, dark almond eyes set into the
 * hollows, a rim in the wearer's colour and their emblem raised on the brow. About two units tall, facing +z.
 */
export function maskGeometry(design: MaskDesign): THREE.BufferGeometry {
  const shell = skin(design, 'shell').toNonIndexed();
  const dark = new THREE.Color('#050506');
  const parts = [shell];
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(1, 12, 8).scale(Math.min(0.15, design.eyes * 0.62), 0.062, 0.035).rotateZ(side * -0.12).translate(side * design.eyes, EYE_Y, maskHeight(side * design.eyes, EYE_Y, design.eyes) + 0.004);
    parts.push(paint(eye.toNonIndexed(), dark));
  }
  const slope = Math.atan2(maskHeight(0, BROW_Y + 0.1, design.eyes) - maskHeight(0, BROW_Y - 0.1, design.eyes), 0.2);
  const emblem = new THREE.ExtrudeGeometry(emblemShape(design.emblem), { depth: 0.05, bevelEnabled: false }).scale(1.45, 1.45, 1).rotateX(-slope).translate(0, BROW_Y, maskHeight(0, BROW_Y, design.eyes) - 0.01);
  // The emblem is a dark inlay, like the eyes: it reads on a light face and a dark one.
  parts.push(paint(emblem.toNonIndexed(), dark));
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** The inside of a mask alone, sitting just behind its back, to be coloured when the mask is turned over to show a role. */
export function maskLiningGeometry(design: MaskDesign): THREE.BufferGeometry {
  return skin(design, 'lining').translate(0, 0, -0.012);
}
