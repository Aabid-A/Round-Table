import { useEffect, useMemo, useRef, useState } from 'react';
import type { HumanAnswer } from '../../../src/players/human.js';
import type { Phase } from '../../../src/types.js';
import type { PublicPhase } from '../../../src/publicPhase.js';
import { HumanForm, type FormState } from '../play/HumanForm.js';
import { formFor, splitPrompt } from '../play/human.js';
import { useInputKind } from '../scene/input.js';
import { Hud } from '../shell/Hud.js';
import { Shell } from '../shell/Shell.js';
import { InputBar } from '../shell/InputBar.js';
import { Journal, useJournalKey } from '../shell/Journal.js';
import { parsePrompt, type Knowledge } from '../perspective/knowledge.js';
import { FlatRoom } from '../scene/FlatRoom.js';
import { useChooseKeys } from '../scene/Choose.js';
import { BANISH_BEAT_MS, BANISH_BEATS, banishWords, worldFromScene } from '../scene/fromScene.js';
import { useBeat, useRoomChoice, useRoomSound } from '../scene/host.js';
import { momentWords } from '../replay/momentWords.js';
import { LiveRoom } from './LiveRoom.js';
import { newsToPlay, type LiveEvent } from './events.js';
import { liveView, newsHoldMs, ringOrder } from './liveView.js';

/** How long each piece of news stays up in the room. */
export const BEAT_MS = 2800;

/** In a timed turn, how long the role reveal stays before the turn takes over. */
export const REVEAL_TIMED_MS = 5000;

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
  /**
   * Play in the game shell: the room fills the window, the HUD and the input bar lie over it, the form folds away for a screen reader.
   * `menu` is what the HUD's menu holds (leaving the game). Only where the 3D room is shown; the flat room keeps the page layout.
   */
  shell?: { menu: React.ReactNode };
}

/**
 * A live seat: the room seen from your own chair, and your turn made in it. Select a seat, then confirm; the ordinary form under
 * it is the accessible alternative and stays in step with the room. Everything it draws comes from this seat's own prompts.
 */
export function LiveSeat({ turn, publicPhase, onSubmit, children, room3d = false, shell }: Props) {
  const choice = useRoomChoice(window.location.search);
  const [mem, setMem] = useState<{ order: string[]; k: Knowledge | null; before: string[] | null }>({ order: [], k: null, before: null });
  const [reel, setReel] = useState<LiveEvent[]>([]);
  const [beatAt, setBeatAt] = useState(0);
  // The seat chosen in the room belongs to the turn it was chosen on: a new turn never starts with the last one's choice.
  const [pick, setPick] = useState<{ turn: number; name: string | null } | null>(null);
  const picked = pick !== null && pick.turn === turn?.id ? pick.name : null;
  const setPicked = (name: string | null): void => setPick({ turn: turn?.id ?? -1, name });
  // The words typed in the input bar belong to the turn they were typed on.
  const [typed, setTyped] = useState<{ turn: number; text: string } | null>(null);
  const text = typed !== null && typed.turn === turn?.id ? typed.text : '';
  // Your role is told once, at the start, with your mask in your hands, and held until you take your seat.
  const [seated, setSeated] = useState(false);
  const [journal, setJournal] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [lastUser, setLastUser] = useState('');
  const sound = useRoomSound();
  const input = useInputKind();
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
    setLastUser(turn.user);
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
    // In the 3D room a banishment is staged beat by beat: its news stays up until the mask has been turned over.
    const ms = newsHoldMs(reel[beatAt], room3d && choice.room, BEAT_MS);
    const t = setTimeout(() => setBeatAt((i) => i + 1), ms);
    return () => clearTimeout(t);
  }, [reel, beatAt, room3d, choice.room]);
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
  // A banishment in the room is staged beat by beat, as in the replay.
  const beat = useBeat(shown?.stage?.kind === 'banish' ? `${turn?.id ?? ''}:${beatAt}` : null, BANISH_BEATS.length, BANISH_BEAT_MS);
  const said = shown ? (shown.sleep ? 'Night. You sleep.' : momentWords(shown)) : '';
  const inShell = shell !== undefined && room3d && choice.room;
  const revealing = inShell && !seated && k !== null;
  const built = room3d && choice.room && shown ? worldFromScene(shown, shown.stage?.kind === 'banish' ? banishWords(shown.stage.seat, beat, said) : said, beat) : null;
  const world = built && revealing && k ? { ...built, reveal: { role: k.role, partners: k.role === 'traitor' ? k.fellowTraitors : [] }, choosable: [], caption: '' } : built;
  useJournalKey(() => inShell && setJournal((v) => !v));
  // A timed turn (rooms) does not wait for the click: the reveal lets you on after a few seconds, so it never costs the turn.
  const timed = turn !== null && turn.timeoutMs !== null;
  useEffect(() => {
    if (!revealing || !timed) return;
    const t = setTimeout(() => setSeated(true), REVEAL_TIMED_MS);
    return () => clearTimeout(t);
  }, [revealing, timed]);
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

  if (inShell && world && shell) {
    const label = `The room from your chair, ${k.name}`;
    const spec = turn ? formFor(turn.phase, turn.options) : null;
    const figures = spec !== null && turn !== null && turn.options.length > 0 && spec.choices.every((c) => turn.options.includes(c.value)) && canPick;
    const roundTable = turn?.phase === 'round_table';
    return (
      <Shell label="Round Table">
      <div className="live live-shell" data-testid="live-seat">
        <div className="live-room">
          <LiveRoom view={world} choice={choice} onPick={(seat) => (sound.start(), setPicked(nameAt(seat)))} label={label} fallback={<FlatRoom view={shown!} onPick={setPicked} label={label} />} />
        </div>
        <Hud phase={shown!.moment.title} round={shown!.moment.round} muted={sound.muted} onMute={sound.toggleMute} onJournal={() => setJournal((v) => !v)} menu={shell.menu} />
        <Journal open={journal} text={splitPrompt(turn?.user ?? lastUser).context} onClose={() => setJournal(false)} />
        {revealing ? (
          <>
            <button type="button" className="shell-catch" aria-hidden="true" tabIndex={-1} onClick={() => (sound.start(), setSeated(true))} />
            <div className="shell-hold">
              <p className="sr-only" id="role-told">
                {k.role === 'traitor' ? `You are a traitor.${k.fellowTraitors.length ? ` Your partner: ${k.fellowTraitors.join(', ')}.` : ''}` : 'You are faithful.'}
              </p>
              <button type="button" className="inputbar-send" onClick={() => (sound.start(), setSeated(true))} data-testid="take-seat" aria-describedby="role-told" autoFocus>
                Take your seat
              </button>
            </div>
          </>
        ) : turn && spec && !formOpen ? (
          <InputBar
            spec={spec}
            picked={picked}
            figures={figures}
            touch={input === 'touch'}
            text={text}
            onText={(t) => setTyped({ turn: turn.id, text: t })}
            onPick={(v) => setPicked(v)}
            ready={form.ready}
            missing={form.missing}
            onSend={() => (sound.play('confirm'), submit.current?.())}
          />
        ) : null}
        {/* Notices (offline, a timed-out turn, an answer refused) and the clock in words: always shown, over the bar. */}
        {!revealing && <div className={turn ? 'shell-status shell-notes' : 'shell-status'}>{children}</div>}
        {turn && (
          <details className="shell-form" data-testid="shell-form" onToggle={(e) => setFormOpen(e.currentTarget.open)}>
            <summary>Answer with a form instead</summary>
            <HumanForm
              key={`form-${turn.id}`}
              request={{ system: '', user: turn.user, phase: turn.phase, player: k.name, options: turn.options }}
              turn={turn.id}
              picked={picked}
              onPicked={setPicked}
              onState={setForm}
              submitRef={submit}
              outside={{ speech: roundTable ? text : '', message: text }}
              onSubmit={(a) => onSubmit(turn, a)}
            />
          </details>
        )}
      </div>
      </Shell>
    );
  }

  return (
    <div className="live" data-testid="live-seat">
      <div className="live-room">
        {world ? (
          <LiveRoom view={world} choice={choice} onPick={(seat) => setPicked(nameAt(seat))} label={`The room from your chair, ${k.name}`} fallback={<FlatRoom view={shown!} onPick={setPicked} label={`The room from your chair, ${k.name}`} />} />
        ) : (
          <FlatRoom view={shown!} onPick={setPicked} label={`The room from your chair, ${k.name}`} />
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
