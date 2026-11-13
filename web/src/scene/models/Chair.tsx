import { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { woodMaps } from './textures.js';

/** A high-backed chair facing the +z axis, with a seat, four legs, two posts and a carved arch behind. */
export function Chair() {
  const wood = useMemo(() => woodMaps(PALETTE.woodDark, 1), []);
  const back = useMemo(() => {
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
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  }, []);
  const mat = <meshStandardMaterial map={wood.map} bumpMap={wood.bump} bumpScale={1.2} color="#b08a6c" roughness={0.6} />;
  return (
    <group>
      <mesh position-y={0.46} castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.07, 0.54]} />
        {mat}
      </mesh>
      {[[-0.23, -0.22], [0.23, -0.22], [-0.23, 0.22], [0.23, 0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.22, z!]} castShadow>
          <boxGeometry args={[0.06, 0.44, 0.06]} />
          {mat}
        </mesh>
      ))}
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.25]} castShadow>
          <boxGeometry args={[0.055, 0.64, 0.055]} />
          {mat}
        </mesh>
      ))}
      <mesh geometry={back} position={[0, 0.48, -0.3]} castShadow receiveShadow>
        {mat}
      </mesh>
    </group>
  );
}
