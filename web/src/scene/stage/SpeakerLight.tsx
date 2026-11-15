import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';

/**
 * At night, with the candles out, a dim warm light finds whoever is speaking, as if from the embers before them: light says where to
 * look (see /art-direction). One light, always in the scene (so the room's shaders never change), that fades down, moves to the new
 * speaker while dark, and comes up again; it fades out when no one speaks or day comes.
 */
export function SpeakerLight({ seat, on }: { seat: number | null; on: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const at = useRef<number | null>(null);
  useFrame((_, dt) => {
    const l = light.current;
    if (!l) return;
    // It moves only once it has faded out where it was: it never slides across the table.
    if (seat !== at.current && l.intensity < 0.05) at.current = seat;
    const want = on && seat !== null && seat === at.current ? 1.6 : 0;
    l.intensity += (want - l.intensity) * (1 - Math.exp(-dt * 2.5));
    if (at.current === null) return;
    const [x, , z] = figurePose(at.current).position;
    l.position.set(x * 0.72, HEAD_Y - 0.15, z * 0.72);
  });
  return <pointLight ref={light} color="#ffb070" intensity={0} distance={2.4} decay={1.6} />;
}
