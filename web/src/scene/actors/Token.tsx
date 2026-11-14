import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { MASKS } from '../models/masks.js';
import { useReducedMotion } from '../motion.js';
import { tablePoint } from '../layout.js';

/** A vote token: a wooden disc in its owner's accent that slides from the owner's edge of the table to the name voted for, and settles with a small tick of the table. */
export function Token({ owner, target, delay }: { owner: number; target: number; delay: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const from = tablePoint(owner, 1.3);
  const to = tablePoint(target, 0.78);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    t0.current ??= clock.elapsedTime;
    // With motion reduced the token is simply there, on the name, when its turn comes.
    const since = clock.elapsedTime - t0.current - delay;
    const raw = reduced ? (since >= 0 ? 1 : 0) : Math.min(1, Math.max(0, since / 1.1));
    const e = 1 - Math.pow(1 - raw, 3);
    mesh.current.visible = raw > 0;
    mesh.current.position.set(from[0] + (to[0] - from[0]) * e, from[1] + 0.018 + Math.sin(raw * Math.PI) * 0.05, from[2] + (to[2] - from[2]) * e);
  });
  return (
    <mesh ref={mesh} visible={false} castShadow>
      <cylinderGeometry args={[0.075, 0.075, 0.024, 24]} />
      <meshStandardMaterial color={MASKS[owner]!.colour} roughness={0.45} metalness={0.25} emissive={MASKS[owner]!.colour} emissiveIntensity={0.3} />
    </mesh>
  );
}
