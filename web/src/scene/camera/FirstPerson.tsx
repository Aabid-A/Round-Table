import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { approach, idle, useReducedMotion } from '../motion.js';
import { EYE_Y, EYE_Z } from '../models/dimensions.js';
import { bearingTo, fovFor, nearestStop, OVERVIEW, restPitchFor, SWIPE_MAX, yawArcFor } from './fov.js';

/** The eye, at the height of a person seated at the table. */
export const EYE: [number, number, number] = [0, EYE_Y, EYE_Z];

interface Props {
  /** Where the moment is (a speaker, an empty chair): the direction the camera eases toward (radians, 0 straight across, positive right), or null. */
  toward: number | null;
  /** The pointer's look is allowed when nothing is being shown that needs the camera. */
  free: boolean;
  /** The seat the player has chosen. In a tall window the camera turns to it, so a choice made by keyboard is seen. */
  focus: number | null;
  /** The moment is about the whole table (the vote): a tall window widens to take it in. */
  overview: boolean;
}

const PITCH_ARC = 0.2;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * First person, seated. With a mouse the head turns with the pointer within a comfortable arc. On a touch screen the player swipes to
 * look around, and the look comes to rest facing the nearest figure. Either way it eases toward whoever holds the moment and breathes
 * a little; it never snaps, and it can always be looked around (see /game-feel).
 */
export function FirstPerson({ toward, free, focus, overview }: Props) {
  const { camera, gl, size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  // The swipe: how far the player has turned the head, where it is settling, and the finger that is down.
  const swipe = useRef({ yaw: 0, rest: 0, finger: null as number | null, lastX: 0 });
  const yaw = useRef(0);
  const pitch = useRef(-0.18);
  const reduced = useReducedMotion();
  const was = useRef<number | null>(null);
  const wasFree = useRef(free);
  const aspect = size.width / size.height;
  const tall = aspect < 1;
  const arc = yawArcFor(aspect);
  useEffect(() => {
    const el = gl.domElement;
    const s = swipe.current;
    const across = (): number => 2 * Math.atan(Math.tan((fovFor(aspect) * Math.PI) / 360) * aspect);
    const down = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch' || s.finger !== null) return;
      s.finger = e.pointerId;
      s.lastX = e.clientX;
    };
    const move = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      if (e.pointerType !== 'touch') {
        pointer.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
        return;
      }
      if (e.pointerId !== s.finger) return;
      // The room follows the finger, and a little faster, so one swipe across the screen reaches the next seat or two.
      s.yaw = clamp(s.yaw - ((e.clientX - s.lastX) / r.width) * across() * 1.6, -SWIPE_MAX, SWIPE_MAX);
      s.rest = s.yaw;
      s.lastX = e.clientX;
    };
    const up = (e: PointerEvent): void => {
      if (e.pointerId !== s.finger) return;
      s.finger = null;
      s.rest = nearestStop(s.yaw);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, aspect]);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fovFor(aspect);
    cam.updateProjectionMatrix();
  }, [camera, aspect]);
  // The whole table is straight ahead.
  useEffect(() => {
    if (overview) swipe.current.rest = 0;
  }, [overview]);
  // A new speaker takes the look back from wherever a swipe left it. In a tall window, so does a newly chosen figure.
  useEffect(() => {
    if (toward !== null) swipe.current.rest = 0;
  }, [toward]);
  useEffect(() => {
    if (tall && focus !== null) swipe.current.rest = clamp(bearingTo(focus), -SWIPE_MAX, SWIPE_MAX);
  }, [tall, focus]);
  useFrame(({ clock }, dt) => {
    // With motion reduced there is no breathing sway, and the turn toward a speaker is a cut. The look still follows the pointer: that is the player's own movement.
    const t = clock.elapsedTime * idle(reduced);
    const s = swipe.current;
    if (s.finger === null) s.yaw += (s.rest - s.yaw) * approach(dt, 5, reduced);
    // A wide window keeps most of the table in view and only leans toward a speaker; a tall one turns to face them.
    const lean = toward === null ? 0 : tall ? clamp(toward, -SWIPE_MAX, SWIPE_MAX) : clamp(toward * 0.72, -0.85, 0.85);
    const wantYaw = lean + s.yaw + pointer.current.x * arc * (free ? 1 : 0.35);
    const wide = tall && overview;
    const wantPitch = wide ? OVERVIEW.pitch : restPitchFor(aspect) + (free ? -pointer.current.y * PITCH_ARC : 0);
    const cam = camera as THREE.PerspectiveCamera;
    const wantFov = wide ? OVERVIEW.fov : fovFor(aspect);
    if (Math.abs(cam.fov - wantFov) > 0.01) {
      cam.fov += (wantFov - cam.fov) * approach(dt, 2.2, reduced);
      cam.updateProjectionMatrix();
    }
    // Reduced motion: whenever the camera's subject changes (a speaker begins or ends, a choice opens or is made) it cuts; it never pans by itself.
    const cut = reduced && (toward !== was.current || free !== wasFree.current);
    was.current = toward;
    wasFree.current = free;
    // While a finger is down the look keeps up with it; otherwise it eases.
    const k = approach(dt, s.finger === null ? 2.6 : 14, cut);
    yaw.current += (wantYaw - yaw.current) * k;
    pitch.current += (wantPitch - pitch.current) * k;
    camera.position.set(EYE[0] + Math.sin(t * 0.37) * 0.006, EYE[1] + Math.sin(t * 0.9) * 0.007, EYE[2]);
    // Looking across the table (toward -z), then turned by the head's yaw and pitch.
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, -yaw.current, Math.sin(t * 0.4) * 0.002, 'YXZ'));
    // The debug hook a test reads: where the head is turned.
    const shown = yaw.current.toFixed(2);
    if (gl.domElement.dataset.yaw !== shown) gl.domElement.dataset.yaw = shown;
  });
  return null;
}
