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

  it('refuses to start a person who has no connection handler', async () => {
    const { room } = autoRoom(['Quinn']);
    await expect(runRoomGame(room, { seatPlayers: new Map() })).rejects.toThrow('no connection handler for Quinn');
  });
});
