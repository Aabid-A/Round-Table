import { useEffect, useId, useRef, useState } from 'react';
import type { PromptRequest } from '../../../src/players/player.js';
import { emptyAnswer, formFor, isComplete, splitPrompt, type HumanAnswer } from './human.js';

/** What the room outside the form needs to know about it. */
export interface FormState {
  ready: boolean;
  /** What is still missing, in words, or null when Send is possible. */
  missing: string | null;
}

interface Props {
  request: PromptRequest;
  /** A seat chosen in the room. The form takes it as its choice. */
  picked?: string | null;
  /** Called when the choice changes in the form, so the room can show it. */
  onPicked?: (choice: string | null) => void;
  /** Told whether Send is possible and what is missing. */
  onState?: (state: FormState) => void;
  /** Filled in with a function that sends the answer, for a button outside the form. */
  submitRef?: { current: (() => void) | null };
  /** Which of the human's turns this is, from 1. */
  turn: number;
  onSubmit: (answer: HumanAnswer) => void;
}

/** One of the human's turns: what you know, the task, and the form for that phase. */
export function HumanForm({ request, turn, onSubmit, picked, onPicked, onState, submitRef }: Props) {
  const id = useId();
  const spec = formFor(request.phase, request.options);
  const { context, task } = splitPrompt(request.user);
  const [a, setA] = useState<HumanAnswer>(emptyAnswer());
  // Even where "none" is allowed (no whisper, no offer), the person has to choose it, so Send is never an accident.
  const [chosen, setChosen] = useState(false);
  const set = (patch: Partial<HumanAnswer>): void => {
    setA((x) => ({ ...x, ...patch }));
    if ('choice' in patch) setChosen(true);
  };
  const title = useRef<HTMLHeadingElement>(null);
  // Sending replaces this form, so move keyboard focus to the new one instead of dropping it on the page.
  useEffect(() => title.current?.focus(), []);
  const ready = chosen && isComplete(spec, a);
  const NONE = '__none__';
  // A seat picked in the room is this form's choice. (Only a seat the form offers; anything else is ignored.)
  useEffect(() => {
    if (picked === undefined || picked === a.choice) return;
    if (picked === null) setA((x) => ({ ...x, choice: null })), setChosen(false);
    else if (spec.choices.some((c) => c.value === picked)) set({ choice: picked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  const missing = ready
    ? null
    : !chosen || (a.choice === null && spec.noneLabel === null)
      ? 'Choose an answer'
      : spec.speechLabel !== null && a.speech.trim() === ''
        ? 'Write what you say to the table'
        : spec.messageLabel !== null && a.choice !== null && a.message.trim() === ''
          ? 'Write your reason or message'
          : 'Finish the form';
  useEffect(() => {
    onState?.({ ready, missing });
    onPicked?.(chosen ? a.choice : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, missing, chosen, a.choice]);
  if (submitRef) submitRef.current = () => (ready ? onSubmit(a) : undefined);

  return (
    <form
      className="turn"
      data-testid="turn-form"
      data-phase={request.phase}
      data-turn={turn}
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(a);
      }}
    >
      <details className="know" open>
        <summary>What you know</summary>
        <pre className="prompt" tabIndex={0} aria-label="What you know so far">
          {context}
        </pre>
      </details>

      <h2 id={`${id}-title`} ref={title} tabIndex={-1} data-testid="turn-title">
        {spec.title}
      </h2>
      {task && <p className="task">{task}</p>}

      {spec.speechLabel && (
        <label className="field">
          {spec.speechLabel}
          <textarea rows={3} maxLength={600} value={a.speech} onChange={(e) => set({ speech: e.target.value })} />
        </label>
      )}

      <fieldset className="choices">
        <legend>{spec.choiceLabel}</legend>
        {spec.choices.map((c) => (
          <label key={c.value} className="choice" data-on={a.choice === c.value}>
            <input type="radio" name={`${id}-choice`} checked={a.choice === c.value} onChange={() => set({ choice: c.value })} />
            {c.label}
          </label>
        ))}
        {spec.noneLabel && (
          <label className="choice" data-on={chosen && a.choice === null}>
            <input type="radio" name={`${id}-choice`} value={NONE} checked={chosen && a.choice === null} onChange={() => set({ choice: null })} />
            {spec.noneLabel}
          </label>
        )}
      </fieldset>

      {spec.messageLabel && (spec.noneLabel === null || a.choice !== null) && (
        <label className="field">
          {spec.messageLabel}
          <input type="text" maxLength={300} value={a.message} onChange={(e) => set({ message: e.target.value })} />
        </label>
      )}

      <label className="field">
        Your private note (optional). Viewers see it in the log; no one in the game does.
        <input type="text" maxLength={300} value={a.note} onChange={(e) => set({ note: e.target.value })} />
      </label>

      <button type="submit" className="btn btn-primary" disabled={!ready}>
        Send
      </button>
    </form>
  );
}
