import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Role } from '../../../../src/types.js';
import { approach, useReducedMotion } from '../motion.js';
import { MaskMesh } from '../models/MaskMesh.js';
import { captionTexture } from '../models/textures.js';
import { PALETTE } from '../palette.js';

/** How far in front of the eye the mask is held, and how far below it. */
const AHEAD = 0.62;
const BELOW = 0.06;

/**
 * Your role, told the way the room tells everything: your own mask held in your hands turns over, and its lining says what you are
 * (gold for a faithful, red for a traitor). Under it, lit words say it and, for a traitor, who the partners are. It is built from your
 * own role and the partners your own prompt names, nothing else.
 */
export function HeldMask({ mask, role, partners }: { mask: number; role: Role; partners: string[] }) {
  const group = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const words = useRef<THREE.MeshStandardMaterial>(null);
  const flip = useRef(0);
  const age = useRef(0);
  const reduced = useReducedMotion();
  const lines = useMemo(
    () => [role === 'traitor' ? 'You are a traitor.' : 'You are faithful.', ...(role === 'traitor' && partners.length > 0 ? [`Your partner${partners.length > 1 ? 's' : ''}: ${partners.join(', ')}`] : [])],
    [role, partners],
  );
  const drawn = useMemo(() => captionTexture(lines, 1536, { colour: role === 'traitor' ? '#f1a08e' : '#f3dc9a' }), [lines, role]);
  useEffect(() => () => (drawn.texture.dispose(), drawn.alpha.dispose()), [drawn]);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    if (!group.current || !turn.current) return;
    age.current += dt;
    // Held still a moment face down, then turned over toward you.
    const want = age.current > 0.7 ? 1 : 0;
    flip.current = reduced ? want : flip.current + (want - flip.current) * approach(dt, 2.4, false);
    camera.getWorldDirection(fwd);
    group.current.position.copy(camera.position).addScaledVector(fwd, AHEAD);
    group.current.position.y -= BELOW;
    group.current.quaternion.copy(camera.quaternion);
    turn.current.rotation.y = Math.PI * (1 - flip.current);
    turn.current.position.y = Math.sin(flip.current * Math.PI) * 0.04;
    if (words.current) words.current.opacity = Math.max(0, Math.min(1, (flip.current - 0.6) / 0.4));
  });
  return (
    <group ref={group} renderOrder={900}>
      <group ref={turn}>
        <MaskMesh index={mask} scale={0.11} lining={role === 'traitor' ? PALETTE.traitor : PALETTE.faithful} />
      </group>
      <mesh position={[0, -0.135, 0]} scale={[0.42, 0.42 / drawn.aspect, 1]} renderOrder={1001}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial ref={words} color="#000" emissive="#fff" emissiveMap={drawn.texture} alphaMap={drawn.alpha} transparent opacity={0} depthTest={false} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}
