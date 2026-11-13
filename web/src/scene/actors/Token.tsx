import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { MASKS } from '../models/masks.js';
import { PALETTE } from '../palette.js';
import { tablePoint } from '../layout.js';

/** A vote token: a wooden disc in its owner's accent that slides from the owner's edge of the table to the name voted for, and settles with a small tick of the table. */
export function Token({ owner, target, delay }: { owner: number; target: number; delay: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  const from = tablePoint(owner, 1.3);
  const to = tablePoint(target, 0.78);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    t0.current ??= clock.elapsedTime;
    const raw = Math.min(1, Math.max(0, (clock.elapsedTime - t0.current - delay) / 1.1));
    const e = 1 - Math.pow(1 - raw, 3);
    mesh.current.visible = raw > 0;
    mesh.current.position.set(from[0] + (to[0] - from[0]) * e, from[1] + 0.018 + Math.sin(raw * Math.PI) * 0.05, from[2] + (to[2] - from[2]) * e);
  });
  return (
    <mesh ref={mesh} visible={false} castShadow>
      <cylinderGeometry args={[0.055, 0.055, 0.02, 20]} />
      <meshStandardMaterial color={MASKS[owner]!.colour} roughness={0.45} metalness={0.25} emissive={PALETTE.amber} emissiveIntensity={0.05} />
    </mesh>
  );
}
