import { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { woodMaps } from './textures.js';

export const TABLE_R = 1.55;
export const TABLE_Y = 0.78;
/** How far from the middle the chairs stand. */
export const SEAT_R = 2.35;

/** The heavy round table: a thick top with a rounded edge, an inlaid ring, a skirt and a turned pedestal. */
export function Table() {
  const wood = useMemo(() => woodMaps(PALETTE.wood, 2), []);
  const pedestal = useMemo(() => {
    const pts = [[0.9, 0], [0.82, 0.08], [0.5, 0.14], [0.3, 0.3], [0.22, 0.45], [0.34, 0.55], [0.2, 0.62], [0.18, 0.7], [0.5, TABLE_Y - 0.2]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  return (
    <group>
      <mesh position-y={TABLE_Y - 0.07} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R - 0.04, 0.14, 64]} />
        <meshStandardMaterial map={wood.map} bumpMap={wood.bump} bumpScale={1.6} color="#caa488" roughness={0.5} metalness={0.02} />
      </mesh>
      <mesh position-y={TABLE_Y - 0.14} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[TABLE_R - 0.02, 0.05, 12, 64]} />
        <meshStandardMaterial color={PALETTE.woodLight} roughness={0.4} />
      </mesh>
      <mesh position-y={TABLE_Y + 0.002} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[TABLE_R - 0.34, TABLE_R - 0.3, 64]} />
        <meshStandardMaterial color="#c9a45a" roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position-y={TABLE_Y - 0.3} castShadow>
        <cylinderGeometry args={[TABLE_R - 0.3, TABLE_R - 0.25, 0.3, 48]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.65} />
      </mesh>
      <mesh geometry={pedestal} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.6} />
      </mesh>
    </group>
  );
}
