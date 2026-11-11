import { describe, expect, it } from 'vitest';
import { runRoomGame } from '../../server/game.js';
import { autoRoom } from './helpers.js';

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
});
