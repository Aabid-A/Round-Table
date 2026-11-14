import { SEATS } from './layout.js';
import type { SceneView } from './view.js';
import { CANDLES, type WorldBanish, type WorldView } from './world.js';

/** The beats of a staged banishment, one after another: the chair pushed back, the figure leaving, the mask turned over, quiet. */
export const BANISH_BEATS: WorldBanish['stage'][] = ['pushback', 'leave', 'mask', 'done'];

/** How long each beat of a banishment is held, in milliseconds, and so the least time a banishment step stays up. */
export const BANISH_BEAT_MS = 1500;
export const BANISH_MS = BANISH_BEATS.length * BANISH_BEAT_MS + 1000;

/**
 * The words for a banishment beat by beat: what is seen happen, and the role only once the mask is turned over (`full` holds it).
 * Never the result before the moment (see /game-feel).
 */
export function banishWords(name: string, beat: number, full: string): string {
  if (beat <= 0) return `${name}'s chair is pushed back.`;
  if (beat === 1) return `${name} stands and leaves the table.`;
  return full;
}

/**
 * The room for a scene view, as the WebGL world draws it. It reads nothing but the scene view, so what reaches the screen is what the
 * view's builder decided this viewer may see. A seated viewer's chair is turned to the camera (seat 0); everyone keeps their own mask.
 * `beat` is how far a staged banishment has got (see BANISH_BEATS); `announce` is the words for the live region and the prompt.
 */
export function worldFromScene(scene: SceneView, announce: string, beat = BANISH_BEATS.length - 1): WorldView {
  const castIndex = new Map(scene.seats.map((s, i) => [s.name, i] as const));
  const from = scene.viewer === null ? null : (castIndex.get(scene.viewer) ?? null);
  const seatOf = (name: string): number => {
    const i = castIndex.get(name) ?? 0;
    return from === null ? i : (i - from + SEATS) % SEATS;
  };
  const seatOrNull = (name: string | null | undefined): number | null => (name && castIndex.has(name) ? seatOf(name) : null);
  const stage = scene.stage ?? null;
  const step = BANISH_BEATS[Math.max(0, Math.min(BANISH_BEATS.length - 1, beat))]!;
  const banishing = stage?.kind === 'banish' ? stage.seat : null;
  const speaking = scene.moment.kind === 'speech' ? seatOrNull(scene.moment.speaker) : null;
  const target = seatOrNull(scene.moment.target);
  const whisper = stage?.kind === 'whisper' ? { from: seatOf(stage.from), to: seatOf(stage.to) } : null;
  const figures = scene.seats.map((s, i) => ({
    index: seatOf(s.name),
    name: s.name,
    mask: i,
    // A player being banished is still in the chair until the beat in which they leave.
    present: s.status === 'alive' || (s.name === banishing && step === 'pushback'),
    // The role of a player being banished is shown only once the mask is turned over, never while they are still in the chair.
    revealed: s.status === 'alive' || (s.name === banishing && (step === 'pushback' || step === 'leave')) ? null : s.role,
    ...(s.mark === 'fellow' ? { fellow: true } : {}),
  }));
  const looks = figures
    .sort((a, b) => a.index - b.index)
    .map((f) => {
      if (whisper) return f.index === whisper.from ? whisper.to : f.index === whisper.to ? whisper.from : null;
      if (speaking !== null) return f.index === speaking ? target : speaking;
      if (banishing !== null) return seatOf(banishing);
      return null;
    });
  const dawn = stage?.kind === 'dawn' ? stage : null;
  const votes = stage?.kind === 'votes' || stage?.kind === 'banish' ? stage.votes : [];
  const staged = new Set([banishing, dawn?.victim].filter((n): n is string => !!n));
  return {
    figures: figures.sort((a, b) => a.index - b.index),
    you: from === null ? null : 0,
    ...(from === null ? { shot: { focus: seatOrNull(scene.camera.focus), wide: scene.camera.wide, cut: scene.camera.cut } } : {}),
    mood: scene.night ? 'night' : dawn ? 'dawn' : 'day',
    candlesLit: scene.night || dawn ? 0 : CANDLES,
    speaker: speaking,
    speech: speaking !== null && scene.moment.text ? { text: scene.moment.text, speaker: speaking } : null,
    pointing: speaking !== null && target !== null && target !== speaking ? { from: speaking, at: target } : null,
    looks,
    voting: stage?.kind === 'votes',
    tokens: votes.map((v) => ({ owner: seatOf(v.voter), target: seatOf(v.target) })),
    banish: stage?.kind === 'banish' ? { seat: seatOf(stage.seat), stage: step, role: step === 'mask' || step === 'done' ? stage.role : null } : null,
    dawn: dawn ? { victim: seatOf(dawn.victim), role: dawn.role } : null,
    whisper,
    recruit: stage?.kind === 'recruit' ? { from: seatOf(stage.from), to: seatOf(stage.to) } : null,
    fallen: scene.seats.filter((s) => s.status !== 'alive' && !staged.has(s.name)).map((s) => ({ seat: seatOf(s.name), role: s.role })),
    choosable: [],
    hovered: null,
    selected: null,
    announce,
  };
}
