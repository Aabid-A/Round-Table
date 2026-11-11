import { useId, useState } from 'react';
import type { PromptRequest } from '../../../src/players/player.js';
import { emptyAnswer, formFor, isComplete, splitPrompt, type HumanAnswer } from './human.js';

interface Props {
  request: PromptRequest;
  /** Which of the human's turns this is, from 1. */
  turn: number;
  onSubmit: (answer: HumanAnswer) => void;
}

/** One of the human's turns: what you know, the task, and the form for that phase. */
export function HumanForm({ request, turn, onSubmit }: Props) {
  const id = useId();
  const spec = formFor(request.phase, request.options);
  const { context, task } = splitPrompt(request.user);
  const [a, setA] = useState<HumanAnswer>(emptyAnswer());
  const set = (patch: Partial<HumanAnswer>): void => setA((x) => ({ ...x, ...patch }));
  const NONE = '__none__';

  return (
    <form
      className="turn"
      data-testid="turn-form"
      data-phase={request.phase}
      data-turn={turn}
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        if (isComplete(spec, a)) onSubmit(a);
      }}
    >
      <details className="know" open>
        <summary>What you know</summary>
        <pre className="prompt" tabIndex={0} aria-label="What you know so far">
          {context}
        </pre>
      </details>

      <h2 id={`${id}-title`}>{spec.title}</h2>
      {task && <p className="task">{task}</p>}

      {spec.speechLabel && (
        <label className="field">
          {spec.speechLabel}
          <textarea rows={3} maxLength={600} value={a.speech} onChange={(e) => set({ speech: e.target.value })} />
        </label>
      )}

      <fieldset className="choices">
        <legend className="sr-only">{spec.title}</legend>
        {spec.choices.map((c) => (
          <label key={c.value} className="choice" data-on={a.choice === c.value}>
            <input type="radio" name={`${id}-choice`} checked={a.choice === c.value} onChange={() => set({ choice: c.value })} />
            {c.label}
          </label>
        ))}
        {spec.noneLabel && (
          <label className="choice" data-on={a.choice === null}>
            <input type="radio" name={`${id}-choice`} value={NONE} checked={a.choice === null} onChange={() => set({ choice: null })} />
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

      <button type="submit" className="btn btn-primary" disabled={!isComplete(spec, a)}>
        Send
      </button>
    </form>
  );
}
