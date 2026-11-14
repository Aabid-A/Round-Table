import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../palette.js';
import { useResource } from '../resources.js';
import { woodMaps } from './textures.js';

/** A high-backed chair facing the +z axis as one mesh: a seat, four legs, two posts and a carved arch behind. */
export function chairGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.27, 0);
  s.lineTo(0.27, 0);
  s.lineTo(0.27, 0.78);
  s.quadraticCurveTo(0.27, 1.02, 0, 1.12);
  s.quadraticCurveTo(-0.27, 1.02, -0.27, 0.78);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.13, 0.36);
  hole.lineTo(0.13, 0.36);
  hole.lineTo(0.13, 0.78);
  hole.quadraticCurveTo(0.13, 0.9, 0, 0.94);
  hole.quadraticCurveTo(-0.13, 0.9, -0.13, 0.78);
  hole.closePath();
  s.holes.push(hole);
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(0.56, 0.07, 0.54).translate(0, 0.46, 0),
    ...[[-0.23, -0.22], [0.23, -0.22], [-0.23, 0.22], [0.23, 0.22]].map(([x, z]) => new THREE.BoxGeometry(0.06, 0.44, 0.06).translate(x!, 0.22, z!)),
    ...[-0.25, 0.25].map((x) => new THREE.BoxGeometry(0.055, 0.64, 0.055).translate(x, 0.78, -0.25)),
    new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }).translate(0, 0.48, -0.3),
  ];
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(flat);
  for (const p of [...parts, ...flat]) p.dispose();
  return merged;
}

/** A chair. Every chair in the room is the same geometry and the same wood, made once. */
export function Chair() {
  const geometry = useResource('chair', chairGeometry);
  const wood = useResource('wood:chair', () => woodMaps(PALETTE.woodDark, 1));
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial map={wood.map} bumpMap={wood.bump} bumpScale={1.2} color="#b08a6c" roughness={0.6} />
    </mesh>
  );
}
