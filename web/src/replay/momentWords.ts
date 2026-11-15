import type { SceneView } from '../scene/view.js';

/** The moment alone, as the room's prompt says it: its title and what was said or done, without notes or whispers. */
export const momentWords = (view: SceneView): string => {
  const { title, speaker, text } = view.moment;
  // An event's words often begin with its own title ("Recruitment. Esme offered…"): it is said once.
  if (!text) return title;
  return speaker ? `${title}. ${speaker}: ${text}` : text.startsWith(title) ? text : `${title}. ${text}`;
};
