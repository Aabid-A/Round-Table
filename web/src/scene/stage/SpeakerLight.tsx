import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';

/**
 * At night, with the candles out, a dim warm light finds whoever is speaking, as if from the embers before them: light says where to
 * look (see /art-direction). It comes up over a moment rather than switching on.
 */
export function SpeakerLight({ seat }: { seat: number }) {
  const light = useRef<THREE.PointLight>(null);
  const [x, , z] = figurePose(seat).position;
  useFrame((_, dt) => {
    if (light.current) light.current.intensity += (1.6 - light.current.intensity) * (1 - Math.exp(-dt * 2));
  });
  return <pointLight ref={light} position={[x * 0.72, HEAD_Y - 0.15, z * 0.72]} color="#ffb070" intensity={0} distance={2.4} decay={1.6} />;
}
