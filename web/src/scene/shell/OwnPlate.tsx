import { useEffect, useMemo } from 'react';
import { MASKS } from '../models/masks.js';
import { EYE_Z, TABLE_Y } from '../models/dimensions.js';
import { PLATE_H, PLATE_W, plateTexture } from '../models/textures.js';

/**
 * Your own name plate, on the table's edge in front of you, lettered as you type it (the setup in the world). Drawn only while you
 * choose your name; in the game your plate is not in your own view.
 */
export function OwnPlate({ name, mask }: { name: string; mask: number }) {
  const texture = useMemo(() => plateTexture(name.trim() === '' ? '…' : name, MASKS[mask]!.colour), [name, mask]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[0, TABLE_Y + PLATE_H / 2 + 0.01, EYE_Z - 1.18]} rotation-x={-0.5}>
      <mesh castShadow>
        <boxGeometry args={[PLATE_W + 0.03, PLATE_H + 0.02, 0.012]} />
        <meshStandardMaterial color="#2a2622" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0, 0.0065]}>
        <planeGeometry args={[PLATE_W, PLATE_H]} />
        <meshStandardMaterial map={texture} metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}
