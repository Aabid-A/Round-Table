import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette.js';

interface Props {
  height: number;
  /** 0 to 1: how lit the flame is. Eased toward by the parent, so a candle goes out over a moment. */
  lit: number;
  seed: number;
}

/** A wax candle on an iron stick, with a wick and a flame that flickers and gutters. Wax and iron are lit like everything else; only the flame glows. */
export function Candle({ height, lit, seed }: Props) {
  const flame = useRef<THREE.Mesh>(null);
  const smoke = useRef<THREE.Mesh>(null);
  const stick = useMemo(() => new THREE.LatheGeometry([[0.05, 0], [0.045, 0.02], [0.02, 0.05], [0.014, 0.12], [0.03, 0.14], [0.034, 0.15]].map(([x, y]) => new THREE.Vector2(x, y)), 14), []);
  const wax = useMemo(() => new THREE.LatheGeometry([[0.026, 0], [0.03, 0.02], [0.027, 0.5], [0.022, 0.52]].map(([x, y]) => new THREE.Vector2(x, y)), 14), []);
  const was = useRef(lit);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * 7 + seed * 13;
    const flicker = 0.88 + Math.sin(t) * 0.07 + Math.sin(t * 2.7 + seed) * 0.05;
    if (flame.current) {
      flame.current.scale.set(0.02 * lit * flicker, 0.05 * lit * (0.9 + flicker * 0.2), 0.02 * lit * flicker);
      flame.current.visible = lit > 0.02;
      flame.current.rotation.z = Math.sin(t * 0.7) * 0.12 * lit;
    }
    if (smoke.current) {
      // A thin wisp rises for a moment when the flame has just gone out.
      const fresh = was.current > 0.05 && lit < 0.05 ? 1 : 0;
      smoke.current.userData.age = fresh ? 0 : ((smoke.current.userData.age as number | undefined) ?? 9) + dt;
      const age = smoke.current.userData.age as number;
      smoke.current.visible = age < 3;
      smoke.current.position.y = height + 0.18 + age * 0.16;
      smoke.current.scale.setScalar(0.5 + age * 0.9);
      (smoke.current.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.22 - age * 0.075);
    }
    was.current = lit;
  });
  return (
    <group>
      <mesh geometry={stick} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.iron} roughness={0.45} metalness={0.7} />
      </mesh>
      <mesh geometry={wax} position-y={0.15} scale={[1, height / 0.5, 1]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.wax} roughness={0.55} emissive={PALETTE.amber} emissiveIntensity={0.06 * lit} />
      </mesh>
      <mesh position-y={0.15 + height + 0.012} castShadow>
        <cylinderGeometry args={[0.003, 0.003, 0.03, 6]} />
        <meshStandardMaterial color="#111" roughness={1} />
      </mesh>
      <mesh ref={flame} position-y={0.15 + height + 0.05}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={PALETTE.flame} toneMapped={false} />
      </mesh>
      <mesh ref={smoke} visible={false}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#777" transparent opacity={0} depthWrite={false} roughness={1} />
      </mesh>
    </group>
  );
}
