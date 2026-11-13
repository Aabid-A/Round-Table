import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';
import { idle, useReducedMotion } from '../motion.js';
import { useResource } from '../resources.js';
import { stoneMaps } from './textures.js';

/** A tall stone fireplace on the far wall with logs, embers and flames that lick and shrink. Its light is in stage/Lights. */
export function Fireplace() {
  const stone = useResource('stone:fire', () => stoneMaps(PALETTE.stoneLight, 2));
  const still = !idle(useReducedMotion());
  const tongues = useRef<(THREE.Mesh | null)[]>([]);
  const embers = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    // With motion reduced the fire is a still shape: it glows but does not lick.
    const t = still ? 0 : clock.elapsedTime;
    tongues.current.forEach((m, i) => {
      if (!m) return;
      const k = 1 + Math.sin(t * (5 + i * 1.3) + i * 2) * 0.22 + Math.sin(t * 11 + i) * 0.1;
      m.scale.set(1 - (k - 1) * 0.3, k, 1 - (k - 1) * 0.3);
      m.rotation.z = Math.sin(t * (3 + i) + i) * 0.1;
    });
    if (embers.current) (embers.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 + Math.sin(t * 3.1) * 0.35 + Math.sin(t * 7.3) * 0.2;
  });
  const mat = <meshStandardMaterial map={stone.map} bumpMap={stone.bump} bumpScale={2} roughness={0.92} color="#a9afc4" />;
  return (
    <group position={[0, 0, -8.05]}>
      <mesh position={[-1.35, 1.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 3.4, 0.9]} />
        {mat}
      </mesh>
      <mesh position={[1.35, 1.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 3.4, 0.9]} />
        {mat}
      </mesh>
      <mesh position={[0, 3.55, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[3.7, 0.5, 1.1]} />
        {mat}
      </mesh>
      <mesh position={[0, 4.4, -0.1]} castShadow>
        <boxGeometry args={[2.6, 1.3, 0.8]} />
        {mat}
      </mesh>
      <mesh position={[0, 1.4, -0.3]} receiveShadow>
        <boxGeometry args={[2, 2.8, 0.3]} />
        <meshStandardMaterial color="#0b0b0f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.06, 0.15]} receiveShadow>
        <boxGeometry args={[2.1, 0.12, 0.9]} />
        {mat}
      </mesh>
      {[-0.45, 0.1, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 0.1 + (i % 2) * 0.12]} rotation={[0, 0.5 * (i - 1), Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.95, 10]} />
          <meshStandardMaterial color="#2a1a10" roughness={0.9} emissive={PALETTE.ember} emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh ref={embers} position={[0, 0.17, 0.12]}>
        <boxGeometry args={[1.1, 0.06, 0.55]} />
        <meshStandardMaterial color="#401405" emissive={PALETTE.ember} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {[-0.4, -0.12, 0.16, 0.42].map((x, i) => (
        <mesh key={i} ref={(m) => void (tongues.current[i] = m)} position={[x, 0.55 + (i % 2) * 0.08, 0.12]}>
          <coneGeometry args={[0.2 - (i % 2) * 0.04, 0.9 + (i % 3) * 0.2, 10]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.flame : PALETTE.ember} emissive={i % 2 ? PALETTE.flame : PALETTE.ember} emissiveIntensity={3.2} toneMapped={false} transparent opacity={0.88} />
        </mesh>
      ))}
    </group>
  );
}
