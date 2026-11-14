import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { tablePoint } from '../layout.js';
import { MaskMesh } from '../models/MaskMesh.js';
import { useReducedMotion } from '../motion.js';
import { PALETTE } from '../palette.js';

/** How long the mask takes to cross the table, in seconds. */
const CROSS = 2.4;

/**
 * Recruitment: in the dark a second mask, face down so its red lining shows, is slid across the table from the traitor's place to
 * the one being offered it, and stops there. With motion reduced it is simply there.
 */
export function Recruit({ from, to, mask }: { from: number; to: number; mask: number }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const a = tablePoint(from, 1.1);
  const b = tablePoint(to, 1.1);
  useFrame(({ clock }) => {
    if (!group.current) return;
    t0.current ??= clock.elapsedTime;
    const raw = reduced ? 1 : Math.min(1, (clock.elapsedTime - t0.current - 0.6) / CROSS);
    const e = raw <= 0 ? 0 : 1 - Math.pow(1 - raw, 3);
    group.current.visible = raw > 0;
    group.current.position.set(a[0] + (b[0] - a[0]) * e, a[1] + 0.02, a[2] + (b[2] - a[2]) * e);
    // It turns a little as the hand pushes it, and settles square to its new owner.
    group.current.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]) + (1 - e) * 0.5;
  });
  return (
    <group ref={group} visible={false}>
      {/* face down: the lining is what shows */}
      <group rotation-x={Math.PI / 2}>
        <MaskMesh index={mask} scale={0.16} lining={PALETTE.traitor} />
      </group>
    </group>
  );
}
