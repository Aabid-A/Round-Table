import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { figurePose } from '../layout.js';
import { HEAD_Y } from '../models/cloak.js';
import { captionTexture } from '../models/textures.js';
import { approach, useReducedMotion } from '../motion.js';
import { wrapCaption } from './caption.js';
import { speechPlacement, stackBlocks } from './speech.js';

/** How far in front of the eye the words hang. (The depth of field is off while they show: it would blur them by what lies behind.) */
const AHEAD = 2.6;
/** How wide the words are, as a part of the picture's width: a column beside the speaker on a wide screen, most of a phone's. */
const WIDE = 0.24;
const NARROW = 0.64;
/** The narrowest the words go, in pixels. */
const MIN_PX = 290;
/** A private note is written differently in kind: slanting, in a cold grey-blue, beneath what was said. */
const THOUGHT = { italic: true, colour: '#b8c4e6' };
/** The most lines a private note takes in the room; the live region carries all of it. */
const NOTE_LINES = 5;
/** Half the width of a hooded head, in metres, to keep the words clear of the mask. */
const HEAD_HALF = 0.2;

/**
 * What a figure says, in the room beside its mask: the same pale lit letters as the turn prompt, with no box, bubble or tail. They
 * hang in front of the eye on the line toward the speaker, so they read at one size wherever the speaker sits, and they keep inside
 * the picture when the speaker is at its edge. For a spectator the speaker's private notes (`note`) hang beneath in the same column,
 * written differently: the two are placed as one block, so they never cover each other. The same words go to the live region.
 */
export function Speech({ text, speaker, note = null }: { text: string | null; speaker: number | null; note?: string | null }) {
  const { camera, size, gl } = useThree();
  const words = useRef<THREE.Mesh>(null);
  const noted = useRef<THREE.Mesh>(null);
  const wordsMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const noteMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const reduced = useReducedMotion();
  const narrow = size.width / size.height < 1;
  const width = narrow ? 940 : 1180;
  const said = useMemo(() => (text ? captionTexture(wrapCaption(text, narrow ? 22 : 28), width) : null), [text, narrow, width]);
  // A note is held to a few lines, so the column always fits the picture.
  const thought = useMemo(() => (note ? captionTexture(capLines(wrapCaption(note, narrow ? 24 : 32), NOTE_LINES), width, THOUGHT) : null), [note, narrow, width]);
  useEffect(() => () => said?.texture.dispose(), [said]);
  useEffect(() => () => thought?.texture.dispose(), [thought]);
  useEffect(() => {
    // The debug hooks a test reads: whose words, and whose notes, are in the room.
    gl.domElement.dataset.speaker = speaker === null || !said ? '' : String(speaker);
    gl.domElement.dataset.thinker = speaker === null || !thought ? '' : String(speaker);
  }, [gl, speaker, said, thought]);
  const shown = useRef(0);
  const tmp = useMemo(() => ({ head: new THREE.Vector3(), seen: new THREE.Vector3(), side: new THREE.Vector3(), right: new THREE.Vector3(), at: new THREE.Vector3(), forward: new THREE.Vector3() }), []);
  useEffect(() => void (shown.current = 0), [said, thought]);
  useFrame((_, dt) => {
    if ((!said && !thought) || speaker === null) return;
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
    const blockOf = (d: { aspect: number } | null) => (d ? { x: boxX, y: (boxX / d.aspect) * aspect } : null);
    const column = stackBlocks(blockOf(said), blockOf(thought), 0.04);
    const c = speechPlacement(at, half, column.box);
    shown.current += (1 - shown.current) * approach(dt, 6, reduced);
    const place = (mesh: THREE.Mesh | null, material: THREE.MeshStandardMaterial | null, d: { aspect: number } | null, dy: number): void => {
      if (!mesh || !material || !d) return;
      tmp.at.set(c.x, c.y + dy, 0.5).unproject(cam).sub(cam.position).normalize();
      mesh.position.copy(cam.position).addScaledVector(tmp.at, AHEAD);
      mesh.quaternion.copy(cam.quaternion);
      // Sized on the picture: so many device units wide, at the distance the words hang along their own line of sight.
      const along = AHEAD * tmp.at.dot(tmp.forward.set(0, 0, -1).applyQuaternion(cam.quaternion));
      const w = boxX * along * Math.tan((cam.fov * Math.PI) / 360) * aspect;
      mesh.scale.set(w, w / d.aspect, 1);
      material.opacity = shown.current;
      mesh.visible = shown.current > 0.01;
    };
    place(words.current, wordsMaterial.current, said, column.top);
    place(noted.current, noteMaterial.current, thought, column.bottom);
  });
  if ((!said && !thought) || speaker === null) return null;
  return (
    <>
      {said ? (
        <mesh ref={words} renderOrder={1000} visible={false}>
          <planeGeometry args={[1, 1]} />
          {/* lit letters, as the turn prompt: they give their own light, so they read by candle, by fire and at dawn */}
          <meshStandardMaterial ref={wordsMaterial} color="#000" emissive="#fff" emissiveMap={said.texture} alphaMap={said.alpha} transparent opacity={0} depthTest={false} depthWrite={false} fog={false} />
        </mesh>
      ) : null}
      {thought ? (
        <mesh ref={noted} renderOrder={1000} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial ref={noteMaterial} color="#000" emissive="#fff" emissiveMap={thought.texture} alphaMap={thought.alpha} transparent opacity={0} depthTest={false} depthWrite={false} fog={false} />
        </mesh>
      ) : null}
    </>
  );
}

/** At most `n` lines, the last cut short with an ellipsis when more were left out. */
function capLines(lines: string[], n: number): string[] {
  if (lines.length <= n) return lines;
  const last = lines[n - 1]!;
  // Drop the last word to make room for the ellipsis, unless it is the only word on the line.
  return [...lines.slice(0, n - 1), `${last.includes(' ') ? last.replace(/\s*\S*$/, '') : last} …`];
}
