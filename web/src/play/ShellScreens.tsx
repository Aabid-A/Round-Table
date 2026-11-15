import { useId, useMemo, useState } from 'react';
import type { GameLog } from '../../../src/engine/types.js';
import { finalRoles } from '../replay/timeline.js';
import { END_REASONS, WINNER } from '../result.js';
import { useRoomSound, type RoomChoice } from '../scene/host.js';
import { HallRoom } from '../shell/HallRoom.js';
import { hallView } from '../shell/hall.js';
import { Hud } from '../shell/Hud.js';
import { Shell } from '../shell/Shell.js';
import { checkSetup } from './setupCheck.js';
import type { SoloSetup } from './solo.js';

/**
 * The setup in the room: you sit at the table and letter your name onto the plate in front of you. The opponents are the practice
 * AIs; real models sit behind one small control that opens the key panel.
 */
export function ShellSetup({ choice, error, onStart }: { choice: RoomChoice; error: string | null; onStart: (s: SoloSetup) => void }) {
  const id = useId();
  const sound = useRoomSound();
  const [name, setName] = useState('Sam');
  const [real, setReal] = useState(false);
  const [key, setKey] = useState('');
  const [models, setModels] = useState('');
  const [cap, setCap] = useState('1.00');
  const [problem, setProblem] = useState<string | null>(error);
  const view = useMemo(() => hallView({ you: 0, plate: name }), [name]);
  const submit = (): void => {
    sound.start();
    const r = checkSetup({ name, real, key, models, cap });
    if (!r.ok) return setProblem(r.message);
    if (real) setKey(''); // the key leaves the page; the game holds the only copy, in memory
    onStart(r.setup);
  };
  return (
    <Shell label="Round Table: take a seat">
      <HallRoom view={view} choice={choice} />
      <Hud
        phase="Take a seat"
        muted={sound.muted}
        onMute={sound.toggleMute}
        menu={
          <a className="hud-btn" href="./">
            Back to the title
          </a>
        }
      />
      <form
        className="setup-plate"
        data-testid="setup"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-describedby={problem ? `${id}-err` : undefined}
      >
        <label htmlFor={`${id}-name`}>Your name on the plate</label>
        <input id={`${id}-name`} type="text" value={name} maxLength={20} autoComplete="off" spellCheck={false} onChange={(e) => (setName(e.target.value), setProblem(null))} data-testid="setup-name" />
        {problem && (
          <p className="setup-error" role="alert" id={`${id}-err`}>
            {problem}
          </p>
        )}
        <div className="setup-row">
          <button type="button" className="hud-btn" aria-expanded={real} aria-controls={`${id}-keys`} onClick={() => (setReal((v) => !v), setProblem(null))} data-testid="use-real">
            {real ? 'Use practice AIs' : 'Use real AI models'}
          </button>
          <button type="submit" className="inputbar-send" data-testid="take-seat-start">
            Take your seat
          </button>
        </div>
      </form>
      {real && (
        <div className="keypanel" id={`${id}-keys`} role="group" aria-label="Real AI models" data-testid="keypanel">
          <label>
            Your OpenRouter key
            <input type="password" value={key} onChange={(e) => (setKey(e.target.value), setProblem(null))} autoComplete="new-password" spellCheck={false} />
          </label>
          <p className="hint" data-testid="key-note">
            The key stays in this tab&rsquo;s memory. It is sent only to OpenRouter, never saved, and not put in the game log.
          </p>
          <label>
            Seven model IDs, one per line
            <textarea rows={7} value={models} onChange={(e) => (setModels(e.target.value), setProblem(null))} spellCheck={false} />
          </label>
          <label>
            Spend cap in US dollars
            <input type="text" inputMode="decimal" value={cap} onChange={(e) => (setCap(e.target.value), setProblem(null))} />
          </label>
        </div>
      )}
    </Shell>
  );
}

/**
 * The end, at the table: every mask turns over before its chair, the result comes up, then what next. The details (who was who in
 * words, what the AIs thought of you, the log) are one click away.
 */
export function ShellEnd({ choice, human, log, onAgain, onReplay, onDetails }: { choice: RoomChoice; human: string; log: GameLog; onAgain: () => void; onReplay: () => void; onDetails: () => void }) {
  const sound = useRoomSound();
  const [shared, setShared] = useState<string | null>(null);
  const roles = useMemo(() => finalRoles(log), [log]);
  // You sit in seat 0, the others in their places round the table after you.
  const order = useMemo(() => {
    const at = log.cast.findIndex((c) => c.name === human);
    return [...log.cast.slice(at), ...log.cast.slice(0, at)].map((c) => c.name);
  }, [log, human]);
  const view = useMemo(
    () => hallView({ you: 0, names: order, ending: order.map((name, seat) => ({ seat, role: roles[name] === 'traitor' ? 'traitor' : 'faithful' })) }),
    [order, roles],
  );
  const r = log.result;
  const title = r.winner === null ? 'Game stopped' : WINNER[r.winner];
  const line = `${END_REASONS[r.reason] ?? r.reason} · ${r.rounds} round${r.rounds === 1 ? '' : 's'}`;
  const share = async (): Promise<void> => {
    const text = `I played Round Table as ${human}, a ${roles[human] === 'traitor' ? 'traitor' : 'faithful'}. ${title}. ${line}`;
    const canShare = typeof (navigator as { share?: unknown }).share === 'function';
    try {
      if (canShare) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShared(canShare ? 'Shared.' : 'Copied to the clipboard.');
    } catch {
      setShared('Could not share. You can download the game log from the details.');
    }
  };
  return (
    <Shell label="Round Table: the end">
      <HallRoom view={view} choice={choice} />
      <Hud phase="The end" muted={sound.muted} onMute={sound.toggleMute} menu={<button type="button" className="hud-btn" onClick={onDetails}>Details and the game log</button>} />
      <div className="ending" data-testid="end">
        <h1>{title}</h1>
        <p>{line}</p>
        <p className="sr-only">
          {order.map((n) => `${n}${n === human ? ' (you)' : ''}: ${roles[n] === 'traitor' ? 'traitor' : 'faithful'}`).join('. ')}
        </p>
      </div>
      <div className="shell-hold ending-actions">
        <button type="button" className="inputbar-send" onClick={onAgain} data-testid="play-again">
          Play again
        </button>
        <button type="button" className="hud-btn" onClick={onReplay} data-testid="watch-replay">
          Watch the replay
        </button>
        <button type="button" className="hud-btn" onClick={() => void share()} data-testid="share">
          Share
        </button>
        <button type="button" className="hud-btn" onClick={onDetails}>
          Details
        </button>
        <p className="sr-only" role="status">
          {shared ?? ''}
        </p>
      </div>
    </Shell>
  );
}
