import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** The eye, at the height of a person seated at the table. */
export const EYE: [number, number, number] = [0, 1.2, 2.5];

interface Props {
  /** The direction (radians, 0 straight across the table, positive to the right) the camera eases toward, or null. */
  toward: number | null;
  /** The pointer's look is allowed when nothing is being shown that needs the camera. */
  free: boolean;
}

const YAW_ARC = 0.62;
const PITCH_ARC = 0.2;

/**
 * First person, seated: the head turns with the pointer within a comfortable arc, eases toward whoever holds the moment,
 * and breathes a little. It never snaps, and it can always be looked around (see /game-feel).
 */
export function FirstPerson({ toward, free }: Props) {
  const { camera, gl } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(-0.18);
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  }, [gl]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const wantYaw = (toward !== null ? toward * 0.8 : 0) + (free ? pointer.current.x * YAW_ARC : pointer.current.x * YAW_ARC * 0.35);
    const wantPitch = -0.18 + (free ? -pointer.current.y * PITCH_ARC : 0);
    const k = 1 - Math.exp(-dt * 2.6);
    yaw.current += (wantYaw - yaw.current) * k;
    pitch.current += (wantPitch - pitch.current) * k;
    camera.position.set(EYE[0] + Math.sin(t * 0.37) * 0.006, EYE[1] + Math.sin(t * 0.9) * 0.007, EYE[2]);
    // Looking across the table (toward -z), then turned by the head's yaw and pitch.
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, -yaw.current, Math.sin(t * 0.4) * 0.002, 'YXZ'));
  });
  return null;
}
