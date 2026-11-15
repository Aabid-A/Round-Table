import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { useReducedMotion } from '../motion.js';

/** A whisper seen by a spectator: a faint violet thread arcing over the table from one mask to the other, and drawing itself toward the listener. */
export function WhisperLine({ from, to }: { from: number; to: number }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  const geometry = useMemo(() => {
    const [ax, , az] = figurePose(from).position;
    const [bx, , bz] = figurePose(to).position;
    const a = new THREE.Vector3(ax * 0.9, HEAD_Y, az * 0.9);
    const b = new THREE.Vector3(bx * 0.9, HEAD_Y, bz * 0.9);
    const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 40, 0.008, 5, false);
  }, [from, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    t0.current ??= clock.elapsedTime;
    const grown = reduced ? 1 : Math.min(1, (clock.elapsedTime - t0.current) / 1.2);
    // The thread draws from the whisperer to the listener (a part of the tube's index range), then breathes.
    geometry.setDrawRange(0, Math.floor((geometry.index?.count ?? 0) * grown));
    if (material.current) material.current.emissiveIntensity = 1.1 + Math.sin(clock.elapsedTime * 2.4) * 0.25 * (reduced ? 0 : 1);
    if (mesh.current) mesh.current.visible = grown > 0;
  });
  return (
    <mesh ref={mesh} geometry={geometry}>
      <meshStandardMaterial ref={material} color="#3c2a66" emissive="#b49cff" emissiveIntensity={1.1} roughness={0.6} transparent opacity={0.85} />
    </mesh>
  );
}
