import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { useReducedMotion } from '../motion.js';
import { TABLE_Y } from '../models/dimensions.js';

/** One turn round the table takes this long: slow enough to read as the hall breathing, not a ride. */
const LAP_S = 140;

/**
 * The title screen's camera: a slow drift round the empty table, a little above it, looking at its middle. With motion reduced it
 * holds one still view.
 */
export function Drift() {
  const { camera, gl, size } = useThree();
  const reduced = useReducedMotion();
  const angle = useRef(0.5);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = size.width / size.height < 1 ? 64 : 44;
    cam.updateProjectionMatrix();
    gl.domElement.dataset.shot = 'drift';
  }, [camera, gl, size]);
  useFrame((_, dt) => {
    if (!reduced) angle.current += (dt * Math.PI * 2) / LAP_S;
    const r = size.width / size.height < 1 ? 5.4 : 4.4;
    camera.position.set(Math.sin(angle.current) * r, TABLE_Y + 1.35, Math.cos(angle.current) * r);
    camera.lookAt(0, TABLE_Y + 0.15, 0);
  });
  return null;
}
