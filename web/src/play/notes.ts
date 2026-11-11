import type { GameLog } from '../../../src/engine/types.js';

export interface NoteAboutYou {
  turnId: number;
  round: number;
  phase: string;
  player: string;
  model: string;
  said: string;
  thought: string;
}

const mentions = (text: string, name: string): boolean =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u').test(text);

/** What the AIs privately wrote that names the human, in order. The human's own notes are left out. */
export function notesAbout(log: GameLog, human: string): NoteAboutYou[] {
  const modelOf = new Map(log.cast.map((c) => [c.name, c.model]));
  return log.turns
    .filter((t) => t.player !== human && t.private_notes.trim() !== '' && mentions(t.private_notes, human))
    .map((t) => ({
      turnId: t.id,
      round: t.round,
      phase: t.phase,
      player: t.player,
      model: modelOf.get(t.player) ?? '',
      said: t.speech.trim(),
      thought: t.private_notes.trim(),
    }));
}
