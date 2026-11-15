import { useEffect, useMemo, useRef, useState } from 'react';
import type { HumanAnswer } from '../../../src/players/human.js';
import type { Phase } from '../../../src/types.js';
import type { PublicPhase } from '../../../src/publicPhase.js';
import { HumanForm, type FormState } from '../play/HumanForm.js';
import { parsePrompt, type Knowledge } from '../perspective/knowledge.js';
import { Room } from '../scene/Room.js';
import { useChooseKeys } from '../scene/Choose.js';
import { worldFromScene } from '../scene/fromScene.js';
import { useRoomChoice } from '../scene/host.js';
import { momentWords } from '../replay/momentWords.js';
import { LiveRoom } from './LiveRoom.js';
import { newsToPlay, type LiveEvent } from './events.js';
import { liveView, ringOrder } from './liveView.js';

/** How long each piece of news stays up in the room. */
export const BEAT_MS = 2800;

/** The least time a faithful's night lasts on screen, even when the AIs answer at once, so the dark and the waking can be seen. */
export const SLEEP_MS = 1600;

export interface LiveTurn {
  id: number;
  phase: Phase;
  options: string[];
  user: string;
  /** Time the seat has for this turn, if the game has a limit. */
  timeoutMs: number | null;
  error?: string | null;
}

interface Props {
  /** The open turn, or null while others are acting. */
  turn: LiveTurn | null;
  /** The phase everyone at the table is told of while waiting. */
  publicPhase: PublicPhase | null;
  onSubmit: (turn: LiveTurn, answer: HumanAnswer) => void;
  /** Shown beside the room when there is a turn (a clock in words, an error). */
  children?: React.ReactNode;
  /** Show the room in 3D where it can be shown (the flat room stays as its fallback). */
  room3d?: boolean;
}

/**
 * A live seat: the room seen from your own chair, and your turn made in it. Select a seat, then confirm; the ordinary form under
 * it is the accessible alternative and stays in step with the room. Everything it draws comes from this seat's own prompts.
 */
export function LiveSeat({ turn, publicPhase, onSubmit, children, room3d = false }: Props) {
  const choice = useRoomChoice(window.location.search);
  const [mem, setMem] = useState<{ order: string[]; k: Knowledge | null; before: string[] | null }>({ order: [], k: null, before: null });
  const [reel, setReel] = useState<LiveEvent[]>([]);
  const [beatAt, setBeatAt] = useState(0);
  // The seat chosen in the room belongs to the turn it was chosen on: a new turn never starts with the last one's choice.
  const [pick, setPick] = useState<{ turn: number; name: string | null } | null>(null);
  const picked = pick !== null && pick.turn === turn?.id ? pick.name : null;
  const setPicked = (name: string | null): void => setPick({ turn: turn?.id ?? -1, name });
  const [form, setForm] = useState<FormState>({ ready: false, missing: 'Choose an answer' });
  const [left, setLeft] = useState<number | null>(null);
  const submit = useRef<(() => void) | null>(null);
  const [hold, setHold] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startHold = (): void => {
    setHold(true);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHold(false), SLEEP_MS);
  };
  useEffect(() => () => void (holdTimer.current && clearTimeout(holdTimer.current)), []);

  // A new turn: read what it tells this seat, and queue the news it brings for the room to play.
  useEffect(() => {
    if (!turn) return;
    const k = parsePrompt(turn.user);
    if (!k) return;
    // A faithful's first prompt comes after the first night: they slept through it, and wake to its news.
    if (mem.k === null && k.role === 'faithful') startHold();
    setMem((m) => ({ order: ringOrder(m.order, k), k, before: m.k?.history ?? null }));
    // The first prompt this page has seen (a fresh start or a reload) replays only the latest few pieces of news, not the whole game.
    const news = newsToPlay(mem.k?.history ?? null, k.history, k.name, mem.k === null);
    setReel(news);
    setBeatAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn?.id]);
  useEffect(() => {
    if (beatAt >= reel.length) return;
    const t = setTimeout(() => setBeatAt((i) => i + 1), BEAT_MS);
    return () => clearTimeout(t);
  }, [reel, beatAt]);
  useEffect(() => {
    if (!turn || turn.timeoutMs === null) return setLeft(null);
    const end = Date.now() + turn.timeoutMs;
    setLeft(turn.timeoutMs);
    const tick = setInterval(() => setLeft(Math.max(0, end - Date.now())), 250);
    return () => clearInterval(tick);
  }, [turn?.id, turn?.timeoutMs]);

  // Read synchronously, so the room and the form appear together on a turn instead of the form being rebuilt a moment later.
  const parsed = useMemo(() => (turn ? parsePrompt(turn.user) : null), [turn?.id]);
  const k = parsed ?? mem.k;
  const order = useMemo(() => (k ? ringOrder(mem.order, k) : mem.order), [mem.order, k]);
  const view = useMemo(
    () =>
      k
        ? liveView({
            me: k.name,
            order,
            knowledge: k,
            beat: reel[beatAt] ?? null,
            turn: turn ? { phase: turn.phase, options: turn.options, user: turn.user } : null,
            publicPhase,
            picked,
            timer: turn && turn.timeoutMs !== null && left !== null ? { leftMs: left, totalMs: turn.timeoutMs } : null,
          })
        : null,
    [k, order, reel, beatAt, turn, publicPhase, picked, left],
  );
  const shown = view && hold && !view.sleep ? { ...view, sleep: true, night: true } : view;
  const world = room3d && choice.room && shown ? worldFromScene(shown, momentWords(shown)) : null;
  const nameAt = (seat: number): string | null => world?.figures.find((f) => f.index === seat)?.name ?? null;
  // The keys choose among the seats the turn offers, and Enter confirms, as in the slice.
  useChooseKeys(world?.choosable ?? [], world?.selected ?? null, (seat) => setPicked(nameAt(seat)), () => submit.current?.());
  const sleeps = view?.sleep === true;
  useEffect(() => {
    if (sleeps) startHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleeps]);
  if (!view || !k) {
    // Nothing has been said to this seat yet (the first night, before a faithful's first turn): no room to show.
    return turn ? <HumanForm key={`form-${turn.id}`} request={{ system: '', user: turn.user, phase: turn.phase, player: '', options: turn.options }} turn={turn.id} onSubmit={(a) => onSubmit(turn, a)} /> : <>{children}</>;
  }
  const canPick = view.picking !== null;

  return (
    <div className="live" data-testid="live-seat">
      <div className="live-room">
        {world ? (
          <LiveRoom view={world} choice={choice} onPick={(seat) => setPicked(nameAt(seat))} label={`The room from your chair, ${k.name}`} fallback={<Room view={shown!} onPick={setPicked} label={`The room from your chair, ${k.name}`} />} />
        ) : (
          <Room view={shown!} onPick={setPicked} label={`The room from your chair, ${k.name}`} />
        )}
      </div>
      {children}
      {turn && (
        <div className="live-confirm" data-testid="live-confirm">
          <p className="live-chosen" data-testid="live-chosen" aria-live="polite">
            {canPick ? (picked ? `You chose ${picked}.` : 'Choose a seat in the room, or use the form below.') : 'Answer in the form below.'}
          </p>
          <button type="button" className="btn btn-primary" disabled={!form.ready} onClick={() => submit.current?.()} data-testid="live-send">
            Confirm
          </button>
          {!form.ready && form.missing && <p className="hint">{form.missing}.</p>}
        </div>
      )}
      {turn && (
        <HumanForm
          key={`form-${turn.id}`}
          request={{ system: '', user: turn.user, phase: turn.phase, player: k.name, options: turn.options }}
          turn={turn.id}
          picked={picked}
          onPicked={setPicked}
          onState={setForm}
          submitRef={submit}
          onSubmit={(a) => onSubmit(turn, a)}
        />
      )}
    </div>
  );
}
