import { describe, expect, it } from 'vitest';
import type { GameEvent, GameObserver, Turn } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { runGame } from '../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../src/engine/types.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';

const run = (seed: number, observer?: GameObserver) =>
  runGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed, players: createMockPlayers(MOCK_CAST, seed), buildPrompt, systemPrompt: SYSTEM_PROMPT, ...(observer ? { observer } : {}) });

describe('the game observer', () => {
  it('sees the roles first, then every turn and event the log holds, in the order it holds them', async () => {
    const turns: Turn[] = [];
    const events: GameEvent[] = [];
    const order: string[] = [];
    const turnsSeenAtEvent: number[] = [];
    let roles: Record<string, string> | null = null;
    const log = await run(3, {
      start: (i) => ((roles = i.roles), order.push('start')),
      turn: (t) => (turns.push(t), order.push(`t${t.id}`)),
      event: (e) => (events.push(e), turnsSeenAtEvent.push(turns.length - 1), order.push(`e${e.type}`)),
    });
    expect(roles).toEqual(log.roles);
    expect(order[0]).toBe('start');
    expect(turns).toEqual(log.turns);
    expect(events).toEqual(log.events);
    // An event arrives after exactly the turns the log says came before it (afterTurn is the last of them).
    expect(turnsSeenAtEvent).toEqual(log.events.map((e) => e.afterTurn));
  });

  it('cannot change the game: the log is the same with an observer, even one that throws', async () => {
    const plain = await run(5);
    const watched = await run(5, { turn: () => undefined, event: () => undefined });
    const broken = await run(5, {
      start: () => {
        throw new Error('no');
      },
      turn: () => {
        throw new Error('no');
      },
      event: () => {
        throw new Error('no');
      },
    });
    expect(watched).toEqual(plain);
    expect(broken).toEqual(plain);
  });
});
