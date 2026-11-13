import { describe, expect, it } from 'vitest';
import { runRoomGame } from '../../server/game.js';
import { AI_NAMES } from '../../src/cast.js';
import { autoRoom, FakeConn } from './helpers.js';

describe('runRoomGame', () => {
  it('plays a whole game with people and mock AIs and returns a normal log', async () => {
    const { room, seatPlayers } = autoRoom(['Quinn', 'Rae']);
    const log = await runRoomGame(room, { seatPlayers });
    expect(log.schemaVersion).toBe(1);
    expect(log.cast).toHaveLength(8);
    expect(log.cast.filter((c) => c.model === 'human').map((c) => c.name).sort()).toEqual(['Quinn', 'Rae']);
    const quinn = log.turns.filter((t) => t.player === 'Quinn');
    expect(quinn.length).toBeGreaterThan(0);
    expect(quinn.every((t) => !t.fallback)).toBe(true);
    expect(['traitor', 'faithful']).toContain(log.result.winner);
  });

  it('is the same game for the same seed and the same answers', async () => {
    const play = async () => {
      const { room, seatPlayers } = autoRoom(['Quinn']);
      return runRoomGame(room, { seatPlayers });
    };
    expect(await play()).toEqual(await play());
  });

  it('tells everyone only the phase while it runs', async () => {
    const { room, conns, seatPlayers } = autoRoom(['Quinn']);
    await runRoomGame(room, { seatPlayers });
    const statuses = conns.get('Quinn')!.sent.filter((m) => m.t === 'status');
    expect(statuses.length).toBeGreaterThan(5);
    for (const s of statuses) expect(Object.keys(s).sort()).toEqual(['phase', 't']);
  });

  it('announces a phase once when it starts, so the count of statuses reveals nothing about traitors or offers', async () => {
    for (const seed of [3, 7, 11]) {
      const { room, conns, seatPlayers } = autoRoom(['Quinn'], { mode: 'mock' }, seed);
      const log = await runRoomGame(room, { seatPlayers });
      const labels = conns.get('Quinn')!.sent.flatMap((m) => (m.t === 'status' ? [m.phase] : []));
      for (let i = 1; i < labels.length; i++) expect(labels[i], `seed ${seed}: status ${i} repeats`).not.toBe(labels[i - 1]);
      // Each traitor has a night turn, and a second round of them if they disagree; none of that shows.
      expect(labels.filter((l) => l === 'night'), `seed ${seed}`).toHaveLength(log.result.rounds);
      expect(labels).not.toContain('recruit_choose');
      expect(labels).not.toContain('recruit_respond');
    }
  });

  it('refuses to start a person who has no connection handler', async () => {
    const { room } = autoRoom(['Quinn']);
    await expect(runRoomGame(room, { seatPlayers: new Map() })).rejects.toThrow('no connection handler for Quinn');
  });

  it('stops AI calls in flight and fails later turns at once when the signal aborts', async () => {
    const { room, seatPlayers } = autoRoom(['Quinn'], { mode: 'openrouter', key: 'sk-test-abort', models: ['a/b'], maxCostUsd: 5 });
    const controller = new AbortController();
    let calls = 0;
    // Never answers; ends only when its request is aborted.
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        calls++;
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const game = runRoomGame(room, { seatPlayers, fetchImpl, signal: controller.signal });
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    const log = await game;
    const callsAtAbort = calls;
    expect(callsAtAbort).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(callsAtAbort);
    expect(log.turns.some((t) => t.fallback)).toBe(true);
  });

  describe('with aliases', () => {
    const aliasRoom = (names: string[], seed = 3) => {
      const made = autoRoom(names, { mode: 'mock' }, seed);
      made.room.aliases = true;
      return made;
    };

    it('seats everyone under the eight AI names and records who is behind each', async () => {
      const { room, seatPlayers } = aliasRoom(['Quinn', 'Rae']);
      const log = await runRoomGame(room, { seatPlayers });
      expect(log.cast.map((c) => c.name)).toEqual(AI_NAMES);
      expect(log.cast.filter((c) => c.model === 'human')).toHaveLength(2);
      expect(Object.values(room.people).sort()).toEqual(['Quinn', 'Rae']);
      for (const alias of Object.keys(room.people)) expect(log.cast.find((c) => c.name === alias)?.model).toBe('human');
      // Their turns were played, under the aliases (someone murdered on the first night has none, so look at both together).
      const theirs = log.turns.filter((t) => t.player in room.people);
      expect(theirs.length).toBeGreaterThan(0);
      expect(theirs.every((t) => !t.fallback)).toBe(true);
    });

    it('tells each person their own alias and no one else\'s, and never puts a real name in a prompt', async () => {
      const { room, conns, seatPlayers } = aliasRoom(['Quinn', 'Rae']);
      await runRoomGame(room, { seatPlayers });
      let withTurns = 0;
      for (const name of ['Quinn', 'Rae']) {
        const sent = conns.get(name)!.sent;
        const aliases = sent.flatMap((m) => (m.t === 'alias' ? [m.alias] : []));
        expect(aliases).toEqual([room.aliasOf(name)]);
        const prompts = sent.flatMap((m) => (m.t === 'turn' ? [m.user] : [])).join('\n');
        for (const real of ['Quinn', 'Rae']) expect(prompts, `${name}'s prompts mention ${real}`).not.toContain(real);
        if (prompts !== '') {
          withTurns++;
          expect(prompts).toContain(`You are ${aliases[0]}.`);
        } // (someone murdered on the first night has no turns)
      }
      expect(withTurns).toBeGreaterThan(0);
    });

    it('is the same game for the same seed', async () => {
      const play = async () => {
        const { room, seatPlayers } = aliasRoom(['Quinn']);
        return runRoomGame(room, { seatPlayers });
      };
      expect(await play()).toEqual(await play());
    });
  });

  it('counts failed AI calls against the room\'s spend cap as estimates, so a failing provider cannot spend without limit', async () => {
    const { room, seatPlayers } = autoRoom(['Quinn'], { mode: 'openrouter', key: 'sk-test-cap', models: ['a/b'], maxCostUsd: 0.05 });
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response('{"error":"down"}', { status: 500 });
    }) as unknown as typeof fetch;
    const log = await runRoomGame(room, { seatPlayers, fetchImpl });
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null });
    const aiAttempts = log.turns.filter((t) => t.player !== 'Quinn').flatMap((t) => t.attempts);
    expect(aiAttempts.length).toBeGreaterThan(0);
    expect(aiAttempts.every((a) => a.costEstimatedUsd === 0.01)).toBe(true);
    expect(calls).toBeLessThanOrEqual(5); // the cap of 0.05 at 0.01 a call: it stopped
  });

  it('uses the floor the server was given for failed AI calls', async () => {
    const { room, seatPlayers } = autoRoom(['Quinn'], { mode: 'openrouter', key: 'sk-test-floor', models: ['a/b'], maxCostUsd: 0.5 });
    const down = (async () => new Response('{"error":"down"}', { status: 500 })) as unknown as typeof fetch;
    const log = await runRoomGame(room, { seatPlayers, fetchImpl: down, costFloorUsd: 0.1 });
    const aiAttempts = log.turns.filter((t) => t.player !== 'Quinn').flatMap((t) => t.attempts);
    expect(aiAttempts.every((a) => a.costEstimatedUsd === 0.1)).toBe(true);
    expect(log.result.costCap?.spentUsd).toBe(0.5);
  });
});

describe('runRoomGame with ghosts and spectators', () => {
  const WATCH_SEED = 4;

  it('tells a person about every seat only after they are out, and never a person who is still playing', async () => {
    const { room, conns, seatPlayers } = autoRoom(['Quinn', 'Rae', 'Sam', 'Tia'], { mode: 'mock' }, WATCH_SEED);
    room.ghosts = true;
    const log = await runRoomGame(room, { seatPlayers });
    const outAt = (name: string): number => log.events.findIndex((e) => (e.type === 'breakfast' && e.victim === name) || (e.type === 'banishment' && e.player === name));
    let ghosts = 0;
    for (const name of ['Quinn', 'Rae', 'Sam', 'Tia']) {
      const sent = conns.get(name)!.sent;
      const ghost = sent.flatMap((m, i) => (m.t === 'ghost' ? [{ m, i }] : []));
      if (outAt(name) === -1) {
        expect(ghost, `${name} never left the game and must not be a ghost`).toEqual([]);
        continue;
      }
      ghosts++;
      expect(ghost.length).toBeGreaterThan(0);
      // Nothing for a ghost before their own exit: after the first ghost message they get no more turns, and every turn they were
      // ever asked for came first.
      const firstGhost = ghost[0]!.i;
      expect(sent.slice(firstGhost).some((m) => m.t === 'turn')).toBe(false);
      for (const { m } of ghost) {
        if (m.t !== 'ghost') continue;
        expect(m.seats.find((s) => s.name === name)!.status).not.toBe('alive');
        expect(m.seats).toHaveLength(8);
      }
    }
    expect(ghosts).toBeGreaterThan(0);
  });

  it('sends a ghost the other seats’ own prompts, which hold what they were told and nothing else', async () => {
    const { room, conns, seatPlayers } = autoRoom(['Quinn', 'Rae', 'Sam', 'Tia'], { mode: 'mock' }, WATCH_SEED);
    room.ghosts = true;
    const log = await runRoomGame(room, { seatPlayers });
    const roles = log.roles;
    const prompts = new Set(log.turns.flatMap((t) => t.attempts.map((a) => a.prompt)));
    for (const name of ['Quinn', 'Rae', 'Sam', 'Tia']) {
      for (const m of conns.get(name)!.sent) {
        if (m.t !== 'ghost') continue;
        for (const s of m.seats) {
          if (s.prompt === null) continue;
          expect(prompts.has(s.prompt) || [...prompts].some((p) => s.prompt!.startsWith(p)), `${s.name}'s prompt is a real prompt`).toBe(true);
          expect(s.prompt).toContain(`You are ${s.name}. Your role: ${roles[s.name]}`);
          expect(s.prompt).not.toContain('MOCKNOTE');
        }
      }
    }
  });

  it('has no ghost and keeps nothing without the option', async () => {
    const { room, conns, seatPlayers } = autoRoom(['Quinn', 'Rae', 'Sam', 'Tia'], { mode: 'mock' }, WATCH_SEED);
    await runRoomGame(room, { seatPlayers });
    expect(room.watching).toBeNull();
    for (const c of conns.values()) expect(c.sent.some((m) => m.t === 'ghost' || m.t === 'spectate')).toBe(false);
  });

  it('shows a spectator each full round once, never the round being played, and never to a player', async () => {
    const { room, conns, seatPlayers } = autoRoom(['Quinn', 'Rae', 'Sam', 'Tia'], { mode: 'mock' }, WATCH_SEED);
    room.enableSpectators();
    const watcher = new FakeConn();
    expect(room.addWatcher(watcher).ok).toBe(true);
    const log = await runRoomGame(room, { seatPlayers });
    const spec = watcher.sent.filter((m) => m.t === 'spectate');
    expect(spec.length).toBeGreaterThan(1);
    let last = -1;
    for (const m of spec) {
      if (m.t !== 'spectate') continue;
      expect(m.complete).toBe(false);
      const rounds = Math.max(0, ...(m.log?.turns.map((t) => t.round) ?? [0]));
      expect(rounds).toBeGreaterThan(last); // each message adds a round
      last = rounds;
      expect(m.log!.result).toBeNull();
      expect(m.log!.turns).toEqual(log.turns.filter((t) => t.round <= rounds));
    }
    expect(last).toBeLessThan(log.result.rounds); // never the last round, until the game is over
    for (const c of conns.values()) expect(c.sent.some((m) => m.t === 'spectate')).toBe(false);
  });
});
