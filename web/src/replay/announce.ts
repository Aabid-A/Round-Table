import type { SceneView } from '../scene/view.js';
import type { StepView } from './describe.js';

/** What a step says, in words: an event's title and body, or who spoke and what they said. */
export const announcement = (view: StepView): string =>
  view.card ? `${view.card.title}. ${view.card.body}` : view.bubble && view.speaker ? `${view.speaker}: ${view.bubble.text}` : '';

/**
 * What a screen reader is told in the room: only what the view holds, never the public step. A seat's view has no notes and no
 * whispers; the all-seeing view adds the speaker's private notes and who whispered to whom, which the drawing shows as a
 * panel and a line a screen reader cannot see.
 */
export const roomAnnouncement = (view: SceneView): string => {
  const { title, speaker, text, thought } = view.moment;
  const parts = [text ? `${title}. ${speaker ? `${speaker}: ` : ''}${text}` : title];
  if (thought) parts.push(`Private notes: ${thought}`);
  for (const w of view.whispers) parts.push(`Whisper from ${w.from} to ${w.to}: ${w.text}`);
  return parts.join('. ');
};
