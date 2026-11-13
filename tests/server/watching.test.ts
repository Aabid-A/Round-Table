import { describe, expect, it } from 'vitest';
import { runGame } from '../../src/engine/game.js';
import { DEFAULT_SETTINGS, type GameLog, type Turn } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import type { Player } from '../../src/players/player.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';
import { Watching } from '../../server/watching.js';

interface Snapshot {
  liveRound: number;
  spectator: ReturnType<Watching['spectatorLog']>;
  visibleRound: number;
}

/** Play a game with a Watching attached the way a room does, and look at it each time a turn is logged. */
async function watched(seed: number, hideModels = false): Promise<{ log: GameLog; w: Watching; snaps: Snapshot[]; ghostAt: Map<string, number> }> {
  const w = new Watching({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed, systemPrompt: SYSTEM_PROMPT, hideModels });
  const snaps: Snapshot[] = [];
  const ghostAt = new Map<string, number>();
  const base = createMockPlayers(MOCK_CAST, seed);
  const players: Record<string, Player> = Object.fromEntries(Object.entries(base).map(([name, p]) => [name, { respond: (req) => (w.prompt(name, req.user), p.respond(req)) }]));
  const log = await runGame({
    cast: MOCK_CAST,
    settings: DEFAULT_SETTINGS,
    seed,
    players,
    buildPrompt,
    systemPrompt: SYSTEM_PROMPT,
    observer: {
      start: (i) => w.start(i.roles),
      turn: (t) => (w.turn(t), snaps.push({ liveRound: t.round, spectator: w.spectatorLog(), visibleRound: w.visibleRound })),
      event: (e) => {
        const left = w.event(e);
        if (left) ghostAt.set(left.name, snaps.length);
      },
    },
  });
  return { log, w, snaps, ghostAt };
}

describe('Watching: what a spectator may see', () => {
  it('is nothing before the game starts, and never a round that is still being played', async () => {
    const empty = new Watching({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: 1, systemPrompt: '', hideModels: false });
    expect(empty.spectatorLog()).toBeNull();
    const { snaps, log } = await watched(4);
    expect(log.result.rounds).toBeGreaterThan(1);
    for (const s of snaps) {
      expect(s.visibleRound).toBe(Math.max(0, s.liveRound - 1));
      const spec = s.spectator!;
      for (const t of spec.turns) expect(t.round, 'a turn of the round being played').toBeLessThan(Math.max(1, s.liveRound));
      for (const e of spec.events) expect(e.round).toBeLessThan(Math.max(1, s.liveRound));
      expect(spec.result).toBeNull();
    }
  });

  it('is exactly one full round behind: every round before the live one, whole, and a prefix of the final log', async () => {
    const { snaps, log } = await watched(4);
    for (const s of snaps) {
      const spec = s.spectator!;
      const upTo = s.visibleRound;
      expect(spec.turns).toEqual(log.turns.filter((t) => t.round <= upTo));
      expect(spec.events).toEqual(log.events.filter((e) => e.round <= upTo));
    }
    // It does move: at least one snapshot shows a full round, and none shows the live one.
    expect(snaps.some((s) => s.spectator!.turns.length > 0)).toBe(true);
  });

  it('carries the roles and the rules, and blanks the models in an alias game until the end', async () => {
    const plain = await watched(2);
    expect(plain.snaps.at(-1)!.spectator!.roles).toEqual(plain.log.roles);
    expect(plain.snaps.at(-1)!.spectator!.cast.map((c) => c.model)).toEqual(MOCK_CAST.map((c) => c.model));
    const alias = await watched(2, true);
    expect(alias.snaps.at(-1)!.spectator!.cast.every((c) => c.model === '')).toBe(true);
    expect(alias.snaps.at(-1)!.spectator!.cast.map((c) => c.name)).toEqual(MOCK_CAST.map((c) => c.name));
  });
});

describe('Watching: nothing newer than the delay, in any field', () => {
  it('leaves out the seed (which decides every role) and the roles until a full round is over, then shows the roles', async () => {
    const { snaps, log } = await watched(4);
    let withRoles = 0;
    for (const s of snaps) {
      const spec = s.spectator!;
      expect(spec.seed).toBe(0);
      expect(JSON.stringify(spec)).not.toContain(`"seed":${log.seed}`);
      if (s.visibleRound < 1) expect(spec.roles, `round ${s.liveRound}`).toEqual({});
      else (withRoles++, expect(spec.roles).toEqual(log.roles));
    }
    expect(withRoles).toBeGreaterThan(0);
    expect(snaps.some((s) => s.visibleRound < 1)).toBe(true); // the first round is played with no roles sent
  });

  const crafted = (round: number): Turn => ({
    id: 0,
    round,
    phase: 'round_table',
    player: 'Aria',
    attempts: [
      { prompt: 'p1', raw: 'not json', error: 'bad', usage: { totalTokens: 9, costUsd: 0.01 }, costEstimatedUsd: 0.01, extracted: true },
      { prompt: 'p2', raw: null, error: 'no answer in time' },
    ],
    speech: 'hello',
    private_notes: 'my plan',
    action: { suspect: 'Bram', reason: 'x' },
    fallback: true,
  });

  it('in an alias game carries nothing that tells a person from a model: no usage, cost, errors, raw replies or fallback flags', () => {
    const w = new Watching({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: 9, systemPrompt: '', hideModels: true });
    w.start({ Aria: 'faithful' });
    w.turn(crafted(1));
    w.turn({ ...crafted(2), id: 1 }); // makes round 1 visible
    const turn = w.spectatorLog()!.turns[0]!;
    expect(turn.attempts).toEqual([{ prompt: 'p1', raw: '', error: null }]);
    expect(turn.fallback).toBe(false);
    expect(JSON.stringify(turn)).not.toMatch(/usage|costEstimated|no answer in time|extracted/);
    // What the replay draws is still there.
    expect(turn).toMatchObject({ speech: 'hello', private_notes: 'my plan', player: 'Aria', action: { suspect: 'Bram' } });
  });

  it('in an ordinary room leaves the turns exactly as the log has them', () => {
    const w = new Watching({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: 9, systemPrompt: '', hideModels: false });
    w.start({ Aria: 'faithful' });
    w.turn(crafted(1));
    w.turn({ ...crafted(2), id: 1 });
    expect(w.spectatorLog()!.turns[0]).toEqual(crafted(1));
  });
});

describe('Watching: what a ghost sees', () => {
  it('lists each seat with what it was last told and whether it is out; a seat is out from the event that took it out', async () => {
    const { w, log, ghostAt } = await watched(3);
    const seats = w.ghostSeats();
    expect(seats.map((s) => s.name)).toEqual(MOCK_CAST.map((c) => c.name));
    for (const s of seats) if (s.prompt !== null) expect(s.prompt).toContain(`You are ${s.name}. Your role: ${log.roles[s.name]}`);
    const outs = log.events.filter((e) => e.type === 'breakfast' || e.type === 'banishment');
    expect(ghostAt.size).toBe(outs.filter((e) => (e.type === 'breakfast' ? e.victim !== null : true)).length);
    for (const [name] of ghostAt) expect(seats.find((s) => s.name === name)!.status).not.toBe('alive');
  });

  it('knows a seat is out only when the game says so', async () => {
    const w = new Watching({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: 1, systemPrompt: '', hideModels: false });
    expect(w.isOut('Aria')).toBe(false);
    expect(w.event({ type: 'breakfast', round: 1, afterTurn: -1, visibleTo: 'all', victim: 'Aria', role: 'faithful' })).toEqual({ name: 'Aria', how: 'murdered' });
    expect(w.isOut('Aria')).toBe(true);
    expect(w.event({ type: 'breakfast', round: 2, afterTurn: 3, visibleTo: 'all', victim: null, role: null })).toBeNull();
    expect(w.ghostSeats().find((s) => s.name === 'Aria')!.status).toBe('murdered');
    expect(w.ghostSeats().find((s) => s.name === 'Bram')!.status).toBe('alive');
  });
});
