import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { approach, idle, useReducedMotion } from '../motion.js';
import { fovFor, restPitchFor, yawArcFor } from './fov.js';

/** The eye, at the height of a person seated at the table. */
export const EYE: [number, number, number] = [0, 1.22, 2.62];

interface Props {
  /** The direction (radians, 0 straight across the table, positive to the right) the camera eases toward, or null. */
  toward: number | null;
  /** The pointer's look is allowed when nothing is being shown that needs the camera. */
  free: boolean;
}

const PITCH_ARC = 0.2;

/**
 * First person, seated: the head turns with the pointer within a comfortable arc, eases toward whoever holds the moment,
 * and breathes a little. It never snaps, and it can always be looked around (see /game-feel).
 */
export function FirstPerson({ toward, free }: Props) {
  const { camera, gl, size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(-0.18);
  const reduced = useReducedMotion();
  const arc = yawArcFor(size.width / size.height);
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  }, [gl]);
  useEffect(() => {
    // Keep the same width of view in a tall window: the vertical angle grows as the window narrows, up to a limit.
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fovFor(size.width / size.height);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  useFrame(({ clock }, dt) => {
    // With motion reduced there is no breathing sway, and the turn toward a speaker is a cut. The look still follows the pointer: that is the player's own movement.
    const t = clock.elapsedTime * idle(reduced);
    const wantYaw = (toward !== null ? Math.max(-0.85, Math.min(0.85, toward * 0.6)) : 0) + (free ? pointer.current.x * arc : pointer.current.x * arc * 0.35);
    const wantPitch = restPitchFor(size.width / size.height) + (free ? -pointer.current.y * PITCH_ARC : 0);
    const k = approach(dt, 2.6, reduced && toward !== null);
    yaw.current += (wantYaw - yaw.current) * k;
    pitch.current += (wantPitch - pitch.current) * k;
    camera.position.set(EYE[0] + Math.sin(t * 0.37) * 0.006, EYE[1] + Math.sin(t * 0.9) * 0.007, EYE[2]);
    // Looking across the table (toward -z), then turned by the head's yaw and pitch.
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, -yaw.current, Math.sin(t * 0.4) * 0.002, 'YXZ'));
  });
  return null;
}
