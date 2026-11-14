import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { captionTexture } from '../models/textures.js';
import { approach, useReducedMotion } from '../motion.js';
import { wrapCaption } from './caption.js';
import { speechPlacement } from './speech.js';

/** How far in front of the eye the words hang: near enough to be over everything, far enough to sit in the room. */
const AHEAD = 1.6;
/** How wide the words are, as a part of the picture's width: a column beside the speaker on a wide screen, most of a phone's. */
const WIDE = 0.24;
const NARROW = 0.64;
/** The narrowest the words go, in pixels. */
const MIN_PX = 290;
/** Half the width of a hooded head, in metres, to keep the words clear of the mask. */
const HEAD_HALF = 0.2;

/**
 * What a figure says, in the room beside its mask: the same pale lit letters as the turn prompt, with no box, bubble or tail. They
 * hang in front of the eye on the line toward the speaker, so they read at one size wherever the speaker sits, and they keep inside
 * the picture when the speaker is at its edge. The same words go to the live region for a screen reader.
 */
export function Speech({ text, speaker }: { text: string | null; speaker: number | null }) {
  const { camera, size, gl } = useThree();
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const reduced = useReducedMotion();
  const narrow = size.width / size.height < 1;
  const drawn = useMemo(() => (text ? captionTexture(wrapCaption(text, narrow ? 22 : 28), narrow ? 940 : 1180) : null), [text, narrow]);
  useEffect(() => () => drawn?.texture.dispose(), [drawn]);
  useEffect(() => {
    // The debug hook a test reads: whose words are in the room.
    gl.domElement.dataset.speaker = speaker === null || !text ? '' : String(speaker);
  }, [gl, speaker, text]);
  const shown = useRef(0);
  const tmp = useMemo(() => ({ head: new THREE.Vector3(), seen: new THREE.Vector3(), side: new THREE.Vector3(), right: new THREE.Vector3(), at: new THREE.Vector3(), forward: new THREE.Vector3() }), []);
  useEffect(() => void (shown.current = 0), [drawn]);
  useFrame((_, dt) => {
    if (!mesh.current || !material.current || !drawn || speaker === null) return;
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const [x, , z] = figurePose(speaker).position;
    tmp.head.set(x, HEAD_Y, z);
    tmp.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    tmp.side.copy(tmp.head).addScaledVector(tmp.right, HEAD_HALF).project(cam);
    const head = tmp.seen.copy(tmp.head).project(cam);
    const behind = head.z > 1;
    // A speaker behind the eye is off to one side: the words wait at that edge of the picture.
    const at = behind ? { x: head.x > 0 ? -2 : 2, y: 0 } : { x: head.x, y: head.y };
    const half = { x: Math.abs(tmp.side.x - head.x), y: Math.abs(tmp.side.x - head.x) * aspect };
    // A part of the picture, but never narrower than a short column of type: a room drawn in a small window still reads.
    const boxX = Math.min(NARROW, Math.max(narrow ? NARROW : WIDE, MIN_PX / size.width)) * 2;
    const box = { x: boxX, y: (boxX / drawn.aspect) * aspect };
    const c = speechPlacement(at, half, box);
    tmp.at.set(c.x, c.y, 0.5).unproject(cam).sub(cam.position).normalize();
    mesh.current.position.copy(cam.position).addScaledVector(tmp.at, AHEAD);
    mesh.current.quaternion.copy(cam.quaternion);
    // Sized on the picture: so many device units wide, at the distance the words hang along their own line of sight.
    const along = AHEAD * tmp.at.dot(tmp.forward.set(0, 0, -1).applyQuaternion(cam.quaternion));
    const width = box.x * along * Math.tan((cam.fov * Math.PI) / 360) * aspect;
    mesh.current.scale.set(width, width / drawn.aspect, 1);
    shown.current += (1 - shown.current) * approach(dt, 6, reduced);
    material.current.opacity = shown.current;
    mesh.current.visible = shown.current > 0.01;
  });
  if (!drawn || speaker === null) return null;
  return (
    <mesh ref={mesh} renderOrder={10} visible={false}>
      <planeGeometry args={[1, 1]} />
      {/* lit letters, as the turn prompt: they give their own light, so they read by candle, by fire and at dawn */}
      <meshStandardMaterial ref={material} color="#000" emissive="#fff" emissiveMap={drawn.texture} alphaMap={drawn.alpha} transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
  );
}
