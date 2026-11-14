import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { useResource } from '../resources.js';
import { stoneMaps } from './textures.js';

const HALL_R = 9;

/** The ring of ten columns, each a base, a shaft and a capital, as one mesh. */
export function columnsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const x = Math.sin(a) * (HALL_R - 1.1);
    const z = Math.cos(a) * (HALL_R - 1.1);
    parts.push(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 14).translate(x, 0.25, z), new THREE.CylinderGeometry(0.38, 0.44, 5.6, 14).translate(x, 3, z), new THREE.CylinderGeometry(0.62, 0.42, 0.5, 14).translate(x, 5.9, z));
  }
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** The round stone hall: floor, curved wall, a ring of columns, and a low ceiling that the dark swallows. Nothing here is lit by itself; the candles and the fire do the work. */
export function Hall() {
  const wall = useResource('stone:wall', () => stoneMaps(PALETTE.stoneLight, 5));
  const floor = useResource('stone:floor', () => stoneMaps(PALETTE.floor, 6));
  const columns = useResource('columns', columnsGeometry);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[HALL_R, 64]} />
        <meshStandardMaterial map={floor.map} bumpMap={floor.bump} bumpScale={1.2} roughness={0.78} metalness={0.05} color="#9aa0b8" />
      </mesh>
      <mesh position-y={3.2} receiveShadow>
        <cylinderGeometry args={[HALL_R, HALL_R, 6.4, 64, 1, true]} />
        <meshStandardMaterial map={wall.map} bumpMap={wall.bump} bumpScale={2} roughness={0.9} side={THREE.BackSide} color="#8f96ae" />
      </mesh>
      <mesh position-y={6.4} rotation-x={Math.PI / 2}>
        <circleGeometry args={[HALL_R, 48]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={1} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={columns} castShadow receiveShadow>
        <meshStandardMaterial map={wall.map} bumpMap={wall.bump} roughness={0.85} color="#9aa0b8" />
      </mesh>
    </group>
  );
}
