import { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { stoneMaps } from './textures.js';

const HALL_R = 9;

/** The round stone hall: floor, curved wall, a ring of columns, and a low ceiling that the dark swallows. Nothing here is lit by itself; the candles and the fire do the work. */
export function Hall() {
  const wall = useMemo(() => stoneMaps(PALETTE.stoneLight, 5), []);
  const floor = useMemo(() => stoneMaps(PALETTE.floor, 6), []);
  const columns = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + Math.PI / 10), []);
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
      {columns.map((a, i) => (
        <group key={i} position={[Math.sin(a) * (HALL_R - 1.1), 0, Math.cos(a) * (HALL_R - 1.1)]}>
          <mesh position-y={0.25} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.65, 0.5, 14]} />
            <meshStandardMaterial map={wall.map} bumpMap={wall.bump} roughness={0.85} color="#9aa0b8" />
          </mesh>
          <mesh position-y={3} castShadow receiveShadow>
            <cylinderGeometry args={[0.38, 0.44, 5.6, 14]} />
            <meshStandardMaterial map={wall.map} bumpMap={wall.bump} roughness={0.85} color="#9aa0b8" />
          </mesh>
          <mesh position-y={5.9} castShadow>
            <cylinderGeometry args={[0.62, 0.42, 0.5, 14]} />
            <meshStandardMaterial map={wall.map} roughness={0.85} color="#9aa0b8" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
