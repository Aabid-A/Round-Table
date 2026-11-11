import { describe, expect, it } from 'vitest';
import { createMockPlayer, createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { createReplayPlayers } from '../../src/players/replay.js';
import type { Player } from '../../src/players/player.js';
import { checkEnd, createState, winnerOf } from '../../src/engine/state.js';
import type { GameLog } from '../../src/engine/types.js';
import { names, play, playMock, reply, rolesFor, scripted } from '../helpers/game.js';

const SEED = 1;
const roles = rolesFor(SEED);
const traitors = names.filter((n) => roles[n] === 'traitor');
const faithfuls = names.filter((n) => roles[n] === 'faithful');

describe('a full mock game', () => {
  it('completes and ends with a result', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const log = await playMock(seed);
      expect(log.schemaVersion).toBe(1);
      expect(log.turns.length).toBeGreaterThan(20);
      expect(['traitor', 'faithful']).toContain(log.result.winner);
      expect(log.result.rounds).toBeLessThanOrEqual(6);
      expect(log.turns.every((t) => !t.fallback)).toBe(true);
    }
  });

  it('is deterministic for a seed and varies across seeds', async () => {
    const a = await playMock(11);
    const b = await playMock(11);
    expect(b).toEqual(a);
    expect(JSON.stringify(await playMock(12))).not.toBe(JSON.stringify(a));
  });

  it('replays identically from the logged raw replies', async () => {
    for (const seed of [1, 2, 3]) {
      const original = await playMock(seed);
      const replayed = await play(createReplayPlayers(original), seed);
      expect(replayed).toEqual(original);
    }
  });

  it('replays a game that had fallbacks and player errors', async () => {
    const players: Record<string, Player> = createMockPlayers(MOCK_CAST, 5);
    players.Dax = createMockPlayer({ seed: 5, name: 'Dax', mode: 'broken' });
    players.Gwen = { respond: async () => { throw new Error('boom'); } };
    const original = await play(players, 5);
    expect(original.turns.some((t) => t.attempts.some((a) => a.raw === null))).toBe(true);
    expect(await play(createReplayPlayers(original), 5)).toEqual(original);
  });
});

describe('privacy', () => {
  it("never puts anyone's private_notes in any prompt", async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const log = await playMock(seed);
      const prompts = log.turns.flatMap((t) => t.attempts.map((a) => a.prompt));
      const notes = log.turns.map((t) => t.private_notes).filter((n) => n !== '');
      expect(notes.length).toBeGreaterThan(20);
      for (const note of notes) {
        const tag = note.split(':')[0] as string;
        expect(prompts.some((p) => p.includes(tag))).toBe(false);
      }
      expect(log.systemPrompt).not.toContain('MOCKNOTE');
    }
  });

  it('shows a whisper only to its sender and recipient', async () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const log = await playMock(seed);
      for (const e of log.events) {
        if (e.type !== 'whisper') continue;
        checked++;
        const tag = /\(WHISPER-[^)]*\)/.exec(e.message)?.[0] as string;
        for (const t of log.turns) {
          const seen = t.attempts.some((a) => a.prompt.includes(tag));
          if (t.player !== e.from && t.player !== e.to) expect(seen).toBe(false);
        }
        const later = log.turns.find((t) => t.player === e.to && t.round === e.round && t.phase === 'round_table');
        if (later) expect(later.attempts[0]?.prompt).toContain(tag);
        const sender = log.turns.find((t) => t.player === e.from && t.round === e.round && t.phase === 'round_table');
        if (sender) expect(sender.attempts[0]?.prompt).toContain(`You whispered to ${e.to}`);
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('only tells traitors who the other traitors are', async () => {
    for (const seed of [1, 2, 3]) {
      const log = await playMock(seed);
      for (const t of log.turns) {
        const prompt = t.attempts[0]?.prompt ?? '';
        const isTraitor = prompt.includes('Your role: traitor');
        expect(prompt.includes('Your fellow traitors') || prompt.includes('only traitor left')).toBe(isTraitor);
        if (log.roles[t.player] === 'traitor') expect(isTraitor).toBe(true);
      }
    }
  });
});

describe('replies with text around the JSON', () => {
  it('accepts the object, marks the attempt extracted, and replays identically', async () => {
    const good = createMockPlayer({ seed: 9, name: 'Dax' });
    const players = createMockPlayers(MOCK_CAST, 9);
    players.Dax = { respond: async (r) => `Let me think about it.\n${await good.respond(r)}\nThat is my answer.` };
    const log = await play(players, 9);
    const dax = log.turns.filter((t) => t.player === 'Dax');
    expect(dax.length).toBeGreaterThan(3);
    for (const t of dax) {
      expect(t.fallback).toBe(false);
      expect(t.attempts).toHaveLength(1);
      expect(t.attempts[0]?.extracted).toBe(true);
    }
    expect(log.turns.filter((t) => t.player !== 'Dax').every((t) => t.attempts.every((a) => !('extracted' in a)))).toBe(true);
    expect(await play(createReplayPlayers(log), 9)).toEqual(log);
  });
});

describe('game settings', () => {
  it('rejects invalid maxRounds', async () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(playMock(1, { maxRounds: bad })).rejects.toThrow('maxRounds');
    }
  });
});

describe('retry and fallback', () => {
  it('keeps notes and whispers out of retry prompts', async () => {
    const players = createMockPlayers(MOCK_CAST, 8);
    const good = createMockPlayer({ seed: 8, name: 'Hugo' });
    // Hugo's first reply of every turn is invalid but contains a note-like string.
    let calls = 0;
    players.Hugo = {
      respond: async (r) => (calls++ % 2 === 0 ? '{"speech":"","private_notes":"MOCKNOTE-LEAK-9999","action":' : good.respond(r)),
    };
    const log = await play(players, 8);
    const retries = log.turns.flatMap((t) => t.attempts.slice(1));
    expect(retries.length).toBeGreaterThan(5);
    const everyone = log.turns.flatMap((t) => t.attempts.map((a) => a.prompt)).join('\n');
    expect(everyone).not.toContain('LEAK-9999');
    for (const t of log.turns) {
      for (const a of t.attempts.slice(1)) expect(a.prompt).toContain('reply is not valid JSON');
    }
  });

  it('retries a broken player exactly once, then falls back, and the game finishes', async () => {
    const players = createMockPlayers(MOCK_CAST, 3);
    let calls = 0;
    const broken = createMockPlayer({ seed: 3, name: 'Dax', mode: 'broken' });
    players.Dax = { respond: (r) => { calls++; return broken.respond(r); } };
    const log = await play(players, 3);
    const daxTurns = log.turns.filter((t) => t.player === 'Dax');
    expect(daxTurns.length).toBeGreaterThan(0);
    for (const t of daxTurns) {
      expect(t.fallback).toBe(true);
      expect(t.attempts).toHaveLength(2);
      expect(t.attempts[0]?.error).toBe('reply is not valid JSON');
      expect(t.attempts[1]?.prompt).toContain('reply is not valid JSON');
      expect(t.private_notes).toBe('');
    }
    expect(calls).toBe(daxTurns.length * 2);
    expect(log.turns.filter((t) => t.player !== 'Dax').every((t) => !t.fallback)).toBe(true);
    expect(log.result.reason).toBeTruthy();
  });

  it('accepts a valid reply on the retry without a fallback', async () => {
    const good = createMockPlayer({ seed: 4, name: 'Dax' });
    let first = true;
    const players = createMockPlayers(MOCK_CAST, 4);
    players.Dax = { respond: async (r) => (first ? ((first = false), '{"nope"') : good.respond(r)) };
    const log = await play(players, 4);
    const turn = log.turns.find((t) => t.player === 'Dax') as GameLog['turns'][number];
    expect(turn.attempts).toHaveLength(2);
    expect(turn.attempts[1]?.error).toBeNull();
    expect(turn.fallback).toBe(false);
  });

  it('logs thrown player errors as raw: null and still finishes', async () => {
    const players = createMockPlayers(MOCK_CAST, 6);
    players.Finn = { respond: async () => { throw new Error('timed out'); } };
    const log = await play(players, 6);
    const t = log.turns.find((x) => x.player === 'Finn') as GameLog['turns'][number];
    expect(t.attempts.map((a) => a.raw)).toEqual([null, null]);
    expect(t.attempts[0]?.error).toBe('timed out');
    expect(t.fallback).toBe(true);
  });

  it('finishes a game where every player is broken', async () => {
    const players = Object.fromEntries(
      names.map((n) => [n, createMockPlayer({ seed: 1, name: n, mode: 'broken' })]),
    );
    const log = await play(players, 1);
    expect(log.turns.every((t) => t.fallback && t.attempts.length === 2)).toBe(true);
    expect(log.result.rounds).toBeGreaterThan(0);
  });
});

describe('win paths', () => {
  const firstTraitorIn = (options: string[]): string | undefined => traitors.find((t) => options.includes(t));
  const firstFaithfulIn = (options: string[]): string | undefined => faithfuls.find((f) => options.includes(f));

  it('faithfuls win by banishing every traitor', async () => {
    const log = await play(
      scripted((req) => {
        if (req.phase !== 'vote') return undefined;
        const t = firstTraitorIn(req.options);
        return t ? reply({ target: t }) : undefined;
      }),
      SEED,
    );
    expect(log.result).toMatchObject({ winner: 'faithful', reason: 'no_traitors', rounds: 2 });
    expect(log.events.filter((e) => e.type === 'banishment').map((e) => e.type === 'banishment' && e.role)).toEqual(['traitor', 'traitor']);
  });

  const hunt = (endChoice: 'end' | 'banish') =>
    scripted((req) => {
      if (req.phase === 'vote') {
        const f = firstFaithfulIn(req.options);
        return f ? reply({ target: f }) : undefined;
      }
      if (req.phase === 'endgame_vote') return reply({ choice: endChoice });
      return undefined;
    });

  it('traitors win when the survivors vote to end', async () => {
    const log = await play(hunt('end'), SEED);
    expect(log.result).toMatchObject({ winner: 'traitor', reason: 'endgame_vote', rounds: 2 });
    expect(log.result.survivors).toHaveLength(4);
    expect(log.events.some((e) => e.type === 'endgame_vote' && e.end)).toBe(true);
  });

  it('keeps going when the endgame vote is not a majority, until no faithfuls remain', async () => {
    const log = await play(hunt('banish'), SEED);
    expect(log.events.filter((e) => e.type === 'endgame_vote').length).toBeGreaterThanOrEqual(1);
    expect(log.result).toMatchObject({ winner: 'traitor', reason: 'no_faithfuls' });
  });

  it('needs a strict majority to end', async () => {
    // 4 survivors, 2 vote end, 2 vote banish: not a strict majority.
    const log = await play(
      scripted((req) => {
        if (req.phase === 'vote') {
          const f = firstFaithfulIn(req.options);
          return f ? reply({ target: f }) : undefined;
        }
        if (req.phase === 'endgame_vote') return reply({ choice: traitors.includes(req.player) ? 'end' : 'banish' });
        return undefined;
      }),
      SEED,
    );
    const first = log.events.find((e) => e.type === 'endgame_vote');
    expect(first).toMatchObject({ type: 'endgame_vote', end: false });
  });

  it('stops at maxRounds', async () => {
    const log = await play(hunt('banish'), SEED, { maxRounds: 1 });
    expect(log.result).toMatchObject({ reason: 'max_rounds', rounds: 1, winner: 'traitor' });
  });

  it('checkEnd covers every ending', () => {
    const base = (): ReturnType<typeof createState> => createState(MOCK_CAST, roles);
    const kill = (s: ReturnType<typeof createState>, list: string[]): void => {
      for (const p of s.players) if (list.includes(p.name)) p.status = 'banished';
    };
    expect(checkEnd(base())).toBeNull();
    const a = base(); kill(a, traitors);
    expect(checkEnd(a)).toBe('no_traitors');
    expect(winnerOf(a)).toBe('faithful');
    const b = base(); kill(b, faithfuls);
    expect(checkEnd(b)).toBe('no_faithfuls');
    expect(winnerOf(b)).toBe('traitor');
    const c = base(); kill(c, [traitors[1] as string, ...faithfuls.slice(1)]);
    expect(checkEnd(c)).toBe('two_remaining');
    expect(winnerOf(c)).toBe('traitor');
  });
});

describe('night', () => {
  const victimOf = (log: GameLog): string | null | undefined => {
    const e = log.events.find((x) => x.type === 'murder');
    return e?.type === 'murder' ? e.victim : undefined;
  };

  it('lets traitors who disagree see each other and propose again, then picks at random', async () => {
    const log = await play(
      scripted((req) => {
        if (req.phase !== 'night') return undefined;
        const idx = traitors.indexOf(req.player);
        return reply({ target: req.options[idx] });
      }),
      SEED,
    );
    const night = log.turns.filter((t) => t.round === 1 && t.phase === 'night');
    expect(night).toHaveLength(4);
    expect(night[2]?.attempts[0]?.prompt).toContain('did not all pick the same target');
    expect(night[0]?.attempts[0]?.prompt).not.toContain('did not all pick');
    const murder = log.events.find((e) => e.type === 'murder');
    expect(murder).toMatchObject({ type: 'murder', method: 'random' });
    expect(murder?.type === 'murder' && murder.proposals.map((p) => p.target)).toContain(victimOf(log));
  });

  it('agrees when the second round of proposals converges', async () => {
    const log = await play(
      scripted((req) => {
        if (req.phase !== 'night') return undefined;
        const converged = req.user.includes('did not all pick');
        return reply({ target: req.options[converged ? 0 : traitors.indexOf(req.player)] });
      }),
      SEED,
    );
    expect(log.events.find((e) => e.type === 'murder')).toMatchObject({ method: 'agreed' });
  });
});

describe('banishment ties', () => {
  const victim = faithfuls[0] as string;
  const alive = names.filter((n) => n !== victim);
  const p = (i: number): string => alive[i - 1] as string;
  const firstVotes: Record<number, number> = { 4: 1, 5: 1, 6: 2, 7: 2, 1: 3, 2: 3, 3: 4 };
  const idx = (n: string): number => alive.indexOf(n) + 1;

  const tieGame = (revote: Record<number, number>) =>
    play(
      scripted((req) => {
        if (req.phase === 'vote') return reply({ target: p(firstVotes[idx(req.player)] as number) });
        if (req.phase === 'revote') return reply({ target: p(revote[idx(req.player)] as number) });
        return undefined;
      }),
      SEED,
      { maxRounds: 1 },
    );

  it('breaks a tie with a revote between the tied players', async () => {
    const log = await tieGame({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 });
    const votes = log.events.filter((e) => e.type === 'vote');
    expect(votes.map((v) => v.type === 'vote' && v.stage)).toEqual(['vote', 'revote']);
    expect(votes[0]).toMatchObject({ leaders: [p(1), p(2), p(3)] });
    expect(log.events.find((e) => e.type === 'banishment')).toMatchObject({ player: p(1), method: 'revote' });
    const revoters = log.turns.filter((t) => t.phase === 'revote');
    expect(revoters).toHaveLength(7);
  });

  it('falls back to the seeded RNG when the revote ties again', async () => {
    const revote = { 1: 2, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3 };
    const log = await tieGame(revote);
    const ban = log.events.find((e) => e.type === 'banishment');
    expect(ban).toMatchObject({ method: 'random' });
    expect([p(1), p(2)]).toContain(ban?.type === 'banishment' && ban.player);
    expect((await tieGame(revote)).events).toEqual(log.events);
  });
});

describe('recruitment', () => {
  const run = (accept: boolean) =>
    play(
      scripted((req) => {
        if (req.phase === 'vote') {
          const t = traitors.find((x) => req.options.includes(x));
          return t ? reply({ target: t }) : undefined;
        }
        if (req.phase === 'recruit_choose') return reply({ target: req.options[0] });
        if (req.phase === 'recruit_respond') return reply({ accept });
        return undefined;
      }),
      SEED,
      { maxRounds: 2 },
    );

  it('turns an accepting faithful into a traitor from then on', async () => {
    const log = await run(true);
    const rec = log.events.find((e) => e.type === 'recruit');
    expect(rec).toMatchObject({ type: 'recruit', accepted: true });
    const target = rec?.type === 'recruit' ? rec.offeredTo : '';
    expect(log.roles[target]).toBe('faithful');
    const night2 = log.turns.filter((t) => t.round === 2 && t.phase === 'night').map((t) => t.player);
    expect(night2).toContain(target);
    const prompt = log.turns.find((t) => t.round === 2 && t.phase === 'night' && t.player === target)?.attempts[0]?.prompt;
    expect(prompt).toContain('Your role: traitor');
    expect(log.result.survivors.find((s) => s.name === target)?.role).toBe('traitor');
  });

  it('leaves a refusing faithful faithful', async () => {
    const log = await run(false);
    const rec = log.events.find((e) => e.type === 'recruit');
    expect(rec).toMatchObject({ type: 'recruit', accepted: false });
    const target = rec?.type === 'recruit' ? rec.offeredTo : '';
    expect(log.turns.filter((t) => t.round === 2 && t.phase === 'night').map((t) => t.player)).not.toContain(target);
    const later = log.turns.filter((t) => t.player === target && t.round >= 1);
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((t) => !t.attempts[0]?.prompt.includes('Your role: traitor'))).toBe(true);
  });

  it('keeps recruitment private to the two players involved', async () => {
    const log = await run(true);
    const rec = log.events.find((e) => e.type === 'recruit');
    expect(rec?.visibleTo).toHaveLength(2);
  });
});
