import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { yawToSeat } from '../layout.js';
import { MASKS } from '../models/masks.js';
import { PALETTE } from '../palette.js';
import { TABLE_Y } from '../models/Table.js';

/** Your own two hands and sleeves on the table edge, so you have a body in the first person. The right one rises to point. */
export function YourHands({ pointAt }: { pointAt: number | null }) {
  const right = useRef<THREE.Group>(null);
  const up = useRef(0);
  const aim = useRef(0);
  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt * 4);
    up.current += ((pointAt !== null ? 1 : 0) - up.current) * k;
    if (pointAt !== null) aim.current += (yawToSeat(pointAt) - aim.current) * k;
    if (right.current) {
      right.current.rotation.x = -0.15 - up.current * 0.95;
      right.current.rotation.y = -aim.current * up.current * 0.9;
      right.current.position.y = TABLE_Y + 0.03 + up.current * 0.18 + Math.sin(clock.elapsedTime * 1.1) * 0.002;
    }
  });
  const arm = (
    <>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.0]} castShadow>
        <capsuleGeometry args={[0.022, 0.36, 4, 10]} />
        <meshStandardMaterial color={PALETTE.robe} roughness={0.95} />
      </mesh>
      {/* the cuff, in your own mask's colour: how you know which one is yours */}
      <mesh position={[0, 0, 0.12]}>
        <torusGeometry args={[0.03, 0.009, 8, 20]} />
        <meshStandardMaterial color={MASKS[0]!.colour} roughness={0.5} emissive={MASKS[0]!.colour} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.2]} castShadow>
        <sphereGeometry args={[0.03, 12, 10]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.7} />
      </mesh>
    </>
  );
  return (
    <group position={[0, 0, 1.55]} rotation-y={Math.PI}>
      <group position={[-0.3, TABLE_Y + 0.03, 0]}>
        <group rotation-x={-0.15}>{arm}</group>
      </group>
      <group ref={right} position={[0.3, TABLE_Y + 0.03, 0]}>
        {arm}
      </group>
    </group>
  );
}
