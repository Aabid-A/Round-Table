import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { MASKS } from '../models/masks.js';

interface Props {
  /** The seat the player's eye is on, or null. */
  hovered: number | null;
  /** The seat the player has chosen, or null. It holds the light when nothing is hovered. */
  selected: number | null;
  /** The mask worn at each seat, for the light's colour. */
  maskOf: (seat: number) => number;
}

/**
 * One small light, in the colour of whoever the player is looking at, that rises in front of that figure: the room's answer to a look.
 * A single light that moves, so seven figures do not each carry one.
 */
export function HoverLight({ hovered, selected, maskOf }: Props) {
  const light = useRef<THREE.PointLight>(null);
  const at = useRef<number | null>(null);
  const colour = useRef(new THREE.Color());
  useFrame((_, dt) => {
    const l = light.current;
    if (!l) return;
    const seat = hovered ?? selected;
    // It fades out where it was before it comes up somewhere else: it never slides across the table.
    if (seat !== at.current && l.intensity < 0.05) at.current = seat;
    const want = seat !== null && seat === at.current ? (seat === selected ? 2.6 : 1.4) : 0;
    l.intensity += (want - l.intensity) * (1 - Math.exp(-dt * 10));
    if (at.current === null) return;
    const [x, , z] = figurePose(at.current).position;
    // A little toward the middle of the table and below the mask, like a candle held up to it.
    l.position.set(x * 0.8, HEAD_Y - 0.25, z * 0.8);
    l.color.copy(colour.current.set(MASKS[maskOf(at.current)]!.colour).lerp(WARM, 0.5));
  });
  return <pointLight ref={light} intensity={0} distance={2.2} decay={1.6} />;
}

const WARM = new THREE.Color('#ffd9a0');
