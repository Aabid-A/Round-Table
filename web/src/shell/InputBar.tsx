import { useEffect, useRef } from 'react';
import type { FormSpec } from '../play/human.js';
import { PICK_NONE } from '../play/HumanForm.js';

interface Props {
  spec: FormSpec;
  /** The answer chosen so far: a figure's name, a choice's value, PICK_NONE, or null. */
  picked: string | null;
  /** The figures may be chosen in the room (the choices are seats), rather than words. */
  figures: boolean;
  touch: boolean;
  text: string;
  onText: (text: string) => void;
  onPick: (value: string | null) => void;
  ready: boolean;
  missing: string | null;
  onSend: () => void;
}

/**
 * The one bar over the bottom of the room on your turn: what to do, the words you say or whisper, and Send. A figure is chosen by
 * clicking it in the room; a choice that is not a figure (accept or refuse, end or banish again) and "none" are buttons here.
 */
export function InputBar({ spec, picked, figures, touch, text, onText, onPick, ready, missing, onSend }: Props) {
  const field = useRef<HTMLInputElement>(null);
  const writes = spec.speechLabel !== null || (spec.messageLabel !== null && picked !== null && picked !== PICK_NONE);
  const label = spec.speechLabel !== null ? 'What you say to the table, naming your suspect' : 'Your whisper';
  // When the words are wanted, the field is where the keys go (on a phone this raises the keyboard under the bar, not over Send).
  useEffect(() => {
    if (writes && !touch) field.current?.focus({ preventScroll: true });
  }, [writes, touch]);
  const chosen = picked === PICK_NONE ? spec.noneLabel : picked !== null ? (spec.choices.find((c) => c.value === picked)?.label ?? picked) : null;
  return (
    <form
      className="inputbar"
      data-testid="inputbar"
      aria-label={spec.title}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSend();
      }}
    >
      <p className="inputbar-ask" data-testid="inputbar-ask">
        {figures ? `${touch ? 'Tap' : 'Click'} a figure. ${spec.choiceLabel}` : spec.choiceLabel}
        {chosen !== null && <strong data-testid="inputbar-chosen"> {chosen}</strong>}
      </p>
      <div className="inputbar-row">
        {!figures &&
          spec.choices.map((c) => (
            <button key={c.value} type="button" className="hud-btn" aria-pressed={picked === c.value} onClick={() => onPick(c.value)}>
              {c.label}
            </button>
          ))}
        {spec.noneLabel !== null && (
          <button type="button" className="hud-btn" aria-pressed={picked === PICK_NONE} onClick={() => onPick(PICK_NONE)} data-testid="inputbar-none">
            {spec.noneLabel}
          </button>
        )}
        {writes && (
          <input
            ref={field}
            className="inputbar-text"
            type="text"
            maxLength={spec.speechLabel !== null ? 600 : 300}
            aria-label={label}
            placeholder={label}
            value={text}
            onChange={(e) => onText(e.target.value)}
            enterKeyHint="send"
            data-testid="inputbar-text"
          />
        )}
        <button type="submit" className="inputbar-send" disabled={!ready} data-testid="inputbar-send">
          Send
        </button>
      </div>
      {!ready && missing && <p className="sr-only" aria-live="polite">{missing}.</p>}
    </form>
  );
}
