import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import type { Role } from '../../../../src/types.js';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { idle, useReducedMotion } from '../motion.js';
import { PALETTE } from '../palette.js';

/**
 * A living player's role, hung above their hood for a spectator: a small gold ring for a faithful, a red blade for a traitor. Two
 * shapes, so the role is read without the colour. It turns slowly and gives its own light.
 */
export function RoleSigil({ seat, role }: { seat: number; role: Role }) {
  const g = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const [x, , z] = figurePose(seat).position;
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = clock.elapsedTime * 0.6 * idle(reduced);
  });
  const colour = role === 'traitor' ? PALETTE.traitor : PALETTE.faithful;
  return (
    <group ref={g} position={[x, HEAD_Y + 0.46, z]}>
      {role === 'traitor' ? (
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.045, 0.16, 4]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.9} roughness={0.35} metalness={0.5} />
        </mesh>
      ) : (
        <mesh>
          <torusGeometry args={[0.055, 0.014, 8, 24]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.7} roughness={0.35} metalness={0.6} />
        </mesh>
      )}
    </group>
  );
}
