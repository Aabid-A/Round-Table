import type { Phase } from '../../../src/types.js';
import type { HumanAnswer } from '../../../src/players/human.js';

export { buildHumanReply, createHumanPlayer, emptyAnswer, type HumanAnswer } from '../../../src/players/human.js';

/** What the form for a phase asks. */
export interface FormSpec {
  title: string;
  /** The visible heading above the list of choices. */
  choiceLabel: string;
  choices: { value: string; label: string }[];
  /** Label for the "none" choice, if the phase allows not choosing. */
  noneLabel: string | null;
  speechLabel: string | null;
  messageLabel: string | null;
}

const names = (options: string[]) => options.map((o) => ({ value: o, label: o }));

export function formFor(phase: Phase, options: string[]): FormSpec {
  const base: FormSpec = { title: '', choiceLabel: '', choices: names(options), noneLabel: null, speechLabel: null, messageLabel: null };
  switch (phase) {
    case 'night':
      return { ...base, title: 'Night: choose who the traitors murder', choiceLabel: 'Who do the traitors murder?' };
    case 'whispers':
      return { ...base, title: 'Whispers: send one private message, or stay quiet', choiceLabel: 'Whisper to', noneLabel: 'Send no whisper', messageLabel: 'Your message' };
    case 'round_table':
      return { ...base, title: 'Round table: speak, then name a suspect', choiceLabel: 'Who do you suspect?', speechLabel: 'What you say to the table', messageLabel: 'Why you suspect them' };
    case 'vote':
      return { ...base, title: 'Banishment vote: who goes?', choiceLabel: 'Vote to banish' };
    case 'revote':
      return { ...base, title: 'Revote: choose between the tied players', choiceLabel: 'Revote for' };
    case 'recruit_choose':
      return { ...base, title: 'A traitor was banished: offer someone a place among the traitors?', choiceLabel: 'Offer a place to', noneLabel: 'Make no offer' };
    case 'recruit_respond':
      return {
        ...base,
        title: 'You have been offered a place among the traitors',
        choiceLabel: 'Your answer',
        choices: [
          { value: 'accept', label: 'Accept and become a traitor' },
          { value: 'refuse', label: 'Refuse and stay faithful' },
        ],
      };
    case 'endgame_vote':
      return {
        ...base,
        title: 'Few players remain: end the game or banish again?',
        choiceLabel: 'Your choice',
        choices: [
          { value: 'end', label: 'End the game now' },
          { value: 'banish', label: 'Banish again' },
        ],
      };
  }
}

/** Is the form filled in enough to send? */
export function isComplete(spec: FormSpec, a: HumanAnswer): boolean {
  if (spec.speechLabel !== null && a.speech.trim() === '') return false;
  const none = spec.noneLabel !== null && a.choice === null;
  if (!none && !spec.choices.some((c) => c.value === a.choice)) return false;
  if (spec.messageLabel !== null && !none && a.message.trim() === '') return false;
  return true;
}

/**
 * Split a model prompt for a person: what you know so far, and the task, without the lines that explain the
 * JSON format to a model.
 */
export function splitPrompt(user: string): { context: string; task: string } {
  const parts = user.trimEnd().split('\n\n');
  const taskBlock = parts.pop() ?? '';
  const task = taskBlock
    .split('\n')
    .filter((line) => !line.startsWith('Action:') && !line.startsWith('Use "speech"'))
    .join('\n')
    .trim();
  return { context: parts.join('\n\n').trim(), task };
}
