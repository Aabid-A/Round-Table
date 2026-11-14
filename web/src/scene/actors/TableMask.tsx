import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { Role } from '../../../../src/types.js';
import { banishedMaskSpot, figurePose } from '../layout.js';
import { MaskMesh } from '../models/MaskMesh.js';
import { approach, useReducedMotion } from '../motion.js';
import { PALETTE } from '../palette.js';

const SCALE = 0.2;
/** How far the mask is tipped up from lying flat, toward the viewer, so it can be read from a seat. */
const TILT = 0.62;

/**
 * A mask left on the table in front of its seat, leaning toward the viewer. It lies face up, then is turned over to show what its
 * wearer was: the inside is lined gold for a faithful and red for a traitor. The silhouette still says whose it was.
 */
/** `at` sets where on the table it lies; by default it lies where a banished player's does (see layout.banishedMaskSpot). */
export function TableMask({ seat, mask, role, viewer, at, scale = SCALE, settled = false, tilt = TILT }: { seat: number; mask: number; role: Role | null; viewer: number | null; at?: [number, number, number]; scale?: number; settled?: boolean; tilt?: number }) {
  const turn = useRef<THREE.Group>(null);
  // A mask that has lain there since an earlier moment is already turned; it does not turn over again.
  const flip = useRef(settled && role !== null ? 1 : 0);
  const reduced = useReducedMotion();
  const p = at ?? banishedMaskSpot(seat);
  const [vx, , vz] = viewer === null ? [0, 0, 0] : figurePose(viewer).position;
  const face = useRef<THREE.Group>(null);
  useFrame(({ camera }, dt) => {
    // Seen from no chair it leans toward the camera, wherever the camera is.
    if (viewer === null && face.current) face.current.rotation.y = Math.atan2(camera.position.x - p[0], camera.position.z - p[2]);
    flip.current += ((role === null ? 0 : 1) - flip.current) * approach(dt, 2.2, reduced);
    if (!turn.current) return;
    // Lifted off the table as it goes over, and set down again.
    turn.current.rotation.y = flip.current * Math.PI;
    turn.current.position.y = Math.sin(flip.current * Math.PI) * 0.14;
  });
  const colour = role === 'traitor' ? PALETTE.traitor : PALETTE.faithful;
  return (
    <group ref={face} position={[p[0], p[1] + 0.09, p[2]]} rotation-y={Math.atan2(vx - p[0], vz - p[2])}>
      <group rotation-x={-(Math.PI / 2 - tilt)}>
        <group ref={turn}>
          <MaskMesh index={mask} scale={scale} lining={role ? colour : null} />
        </group>
      </group>
    </group>
  );
}
