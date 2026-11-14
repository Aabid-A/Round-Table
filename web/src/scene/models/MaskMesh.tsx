import type { Ref } from 'react';
import type * as THREE from 'three';
import { maskGeometry, maskLiningGeometry } from './maskGeometry.js';
import { MASKS } from './masks.js';
import { useResource } from '../resources.js';

interface Props {
  index: number;
  scale?: number;
  /** The colour shown inside the mask once it is turned over (the role's), or null for a mask still worn. */
  lining?: string | null;
  /** The mask's material, for a parent that makes it glow when the player's eye is on it. */
  material?: Ref<THREE.MeshStandardMaterial> | null;
}

/** A mask as real geometry: solid, curved and sculpted, in its seat's own outline, rim colour and emblem. */
export function MaskMesh({ index, scale = 0.15, lining = null, material = null }: Props) {
  const design = MASKS[index]!;
  const geo = useResource(`mask:${index}`, () => maskGeometry(design));
  const inside = useResource(`mask-lining:${index}`, () => maskLiningGeometry(design));
  return (
    <group scale={scale}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial ref={material} vertexColors roughness={0.5} metalness={0.05} emissive={design.colour} emissiveIntensity={0} />
      </mesh>
      {lining ? (
        <mesh geometry={inside}>
          <meshStandardMaterial color={lining} roughness={0.35} metalness={0.4} emissive={lining} emissiveIntensity={0.3} />
        </mesh>
      ) : null}
    </group>
  );
}
