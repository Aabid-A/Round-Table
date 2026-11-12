import { describe, expect, it } from 'vitest';
import type { GameLog, Turn } from '../../src/engine/types.js';
import { liveView, ringOrder, type LiveSnapshot } from '../../web/src/live/liveView.js';
import { parseHistoryLine } from '../../web/src/live/events.js';
import { parsePrompt } from '../../web/src/perspective/knowledge.js';
import { finalRoles } from '../../web/src/replay/timeline.js';
import { publicPhase } from '../../src/publicPhase.js';
import { playMock } from '../helpers/game.js';

/** The snapshot a seat's page holds when this turn opens: what the server (or the solo game) sent, and nothing else. */
function snapshotAt(log: GameLog, turn: Turn, order: string[]): LiveSnapshot {
  const k = parsePrompt(turn.attempts[0]!.prompt)!;
  const options = [...(turn.attempts[0]!.prompt.match(/(?:Valid (?:targets|recipients|suspects|choices)|Faithfuls you can offer): (.*)\./)?.[1]?.split(', ') ?? [])];
  return { me: turn.player, order, knowledge: k, beat: null, turn: { phase: turn.phase, options, user: turn.attempts[0]!.prompt }, publicPhase: publicPhase(turn.phase), picked: null, timer: null };
}

const orderFor = (log: GameLog, seat: string): string[] => {
  let order: string[] = [];
  for (const t of log.turns.filter((x) => x.player === seat)) order = ringOrder(order, parsePrompt(t.attempts[0]!.prompt)!);
  return order;
};

describe('liveView: nothing hidden gets into the room', () => {
  it('for a seat that stays faithful, at every one of its turns in 8 games: no hidden role, no other player’s notes, no whisper it was not in', async () => {
    let checked = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const log = await playMock(seed);
      const roles = finalRoles(log);
      for (const c of log.cast.filter((x) => roles[x.name] === 'faithful')) {
        const order = orderFor(log, c.name);
        for (const t of log.turns.filter((x) => x.player === c.name)) {
          const view = liveView(snapshotAt(log, t, order));
          const json = JSON.stringify(view);
          for (const s of view.seats) {
            if (s.name === c.name) continue;
            if (s.role !== null) expect(s.status, `${seed} ${c.name} turn ${t.id}: ${s.name}`).not.toBe('alive');
            expect(s.mark).toBeNull();
          }
          for (const o of log.turns) if (o.player !== c.name && o.private_notes.trim() !== '') expect(json.includes(JSON.stringify(o.private_notes).slice(1, -1))).toBe(false);
          for (const w of log.turns.filter((x) => x.phase === 'whispers')) {
            const a = w.action as { to?: string | null; message?: string };
            if (typeof a.to === 'string' && (a.message ?? '').length > 8 && w.player !== c.name && a.to !== c.name) expect(json.includes(JSON.stringify(a.message).slice(1, -1))).toBe(false);
          }
          expect(view.moment.thought).toBeNull();
          expect(view.proposals).toEqual([]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('a traitor sees their fellow traitor, and a night proposal only at a night turn', async () => {
    const log = await playMock(1);
    const traitor = log.cast.find((c) => log.roles[c.name] === 'traitor')!.name;
    const order = orderFor(log, traitor);
    const turns = log.turns.filter((t) => t.player === traitor);
    const night = turns.find((t) => t.phase === 'night')!;
    const view = liveView(snapshotAt(log, night, order));
    expect(view.seats.find((s) => s.name === traitor)!.role).toBe('traitor');
    const fellow = view.seats.filter((s) => s.mark === 'fellow').map((s) => s.name);
    expect(fellow.length).toBeGreaterThan(0);
    for (const f of fellow) expect(log.roles[f]).toBe('traitor');
    for (const t of turns.filter((x) => x.phase !== 'night')) expect(liveView(snapshotAt(log, t, order)).proposals).toEqual([]);
  });

  it('leaves out seats empty, with what they were, and never moves a chair', async () => {
    const log = await playMock(3);
    const seat = log.cast.find((c) => finalRoles(log)[c.name] === 'faithful')!.name;
    const turns = log.turns.filter((t) => t.player === seat);
    let order: string[] = [];
    let previous: string[] | null = null;
    for (const t of turns) {
      order = ringOrder(order, parsePrompt(t.attempts[0]!.prompt)!);
      if (previous) expect(order.slice(0, previous.length)).toEqual(previous);
      previous = order;
    }
    expect(order.length).toBe(8);
    const last = liveView(snapshotAt(log, turns.at(-1)!, order));
    const out = last.seats.filter((s) => s.status !== 'alive');
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) expect(o.role).not.toBeNull();
  });
});

describe('liveView: the night, the options and the news', () => {
  const base = (over: Partial<LiveSnapshot>): LiveSnapshot => ({
    me: 'Aria',
    order: ['Aria', 'Bram', 'Cleo'],
    knowledge: { name: 'Aria', role: 'faithful', fellowTraitors: [], round: 1, alive: ['Aria', 'Bram', 'Cleo'], out: [], history: [] },
    beat: null,
    turn: null,
    publicPhase: null,
    picked: null,
    timer: null,
    ...over,
  });

  it('a faithful sleeps through the night (the screen goes dark); a traitor or an unknown role stays dim and awake', () => {
    expect(liveView(base({ publicPhase: 'night' })).sleep).toBe(true);
    expect(liveView(base({ publicPhase: 'whispers' })).sleep).toBe(false);
    const traitor = base({ publicPhase: 'night', knowledge: { ...base({}).knowledge!, role: 'traitor', fellowTraitors: ['Bram'] } });
    expect(liveView(traitor).sleep).toBe(false);
    expect(liveView(traitor).night).toBe(true);
    expect(liveView(base({ publicPhase: 'night', knowledge: null })).sleep).toBe(false);
    expect(liveView(base({ publicPhase: 'night', turn: { phase: 'night', options: ['Cleo'], user: '' } })).sleep).toBe(false);
  });

  it('offers only seats to pick, and picks nothing for answers that are not seats', () => {
    expect(liveView(base({ turn: { phase: 'vote', options: ['Bram', 'Cleo'], user: '' }, picked: 'Bram' })).picking).toEqual({ options: ['Bram', 'Cleo'], picked: 'Bram' });
    expect(liveView(base({ turn: { phase: 'recruit_respond', options: ['accept', 'refuse'], user: '' } })).picking).toBeNull();
    expect(liveView(base({})).picking).toBeNull();
  });

  it('turns the news into a moment: a speech turns the others toward the speaker, a whisper to you leans in from its sender', () => {
    const speech = liveView(base({ beat: parseHistoryLine('Bram said "Let us wait." and suspects Cleo because: quiet.') }));
    expect(speech.moment).toMatchObject({ speaker: 'Bram', kind: 'speech' });
    expect(speech.moment.text).toContain('Let us wait.');
    expect(speech.leanTo).toBe('Bram');
    const whisper = liveView(base({ beat: parseHistoryLine('Cleo whispered to you: "Trust me."') }));
    expect(whisper.whispers).toEqual([{ from: 'Cleo', to: 'Aria', text: 'Trust me.' }]);
    expect(whisper.leanTo).toBe('Cleo');
    expect(liveView(base({ beat: parseHistoryLine('Breakfast: Cleo was murdered in the night. They were a faithful.') })).moment.title).toBe('Breakfast');
  });

  it('is first person: the camera sits in your chair', () => {
    const v = liveView(base({}));
    expect(v.pov).toBe('first');
    expect(v.camera.focus).toBe('Aria');
    expect(v.seats.find((s) => s.name === 'Aria')!.mark).toBe('self');
  });
});
