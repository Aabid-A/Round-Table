import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { Role } from '../../../../src/types.js';
import { tablePoint } from '../layout.js';
import { MaskMesh } from '../models/MaskMesh.js';
import { PALETTE } from '../palette.js';

/**
 * A mask left on the table at a seat, turned over to show what its wearer was: a gold ring under it for a faithful, red for a traitor.
 * It lies face down, then rolls over once the role is known.
 */
export function TableMask({ seat, role }: { seat: number; role: Role | null }) {
  const g = useRef<THREE.Group>(null);
  const flip = useRef(0);
  const p = tablePoint(seat, 0.85);
  useFrame((_, dt) => {
    flip.current += ((role === null ? 0 : 1) - flip.current) * (1 - Math.exp(-dt * 2.2));
    if (g.current) g.current.rotation.x = 1.45 - flip.current * 1.75;
  });
  const colour = role === 'traitor' ? PALETTE.traitor : PALETTE.faithful;
  return (
    <group position={[p[0], p[1] + 0.06, p[2]]}>
      <group ref={g} position-y={0.24} rotation-y={0}>
        <MaskMesh index={seat} scale={0.3} />
      </group>
      {role ? (
        <>
          <mesh rotation-x={-Math.PI / 2} position-y={-0.045}>
            <ringGeometry args={[0.34, 0.4, 48]} />
            <meshBasicMaterial color={colour} toneMapped={false} />
          </mesh>
          <pointLight color={colour} intensity={role === 'traitor' ? 0.55 : 0.3} distance={1.8} position={[0, 0.5, 0.3]} />
        </>
      ) : null}
    </group>
  );
}
