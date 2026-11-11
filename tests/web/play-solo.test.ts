import { describe, expect, it } from 'vitest';
import type { PromptRequest } from '../../src/players/player.js';
import { emptyAnswer, formFor, type HumanAnswer } from '../../web/src/play/human.js';
import { aiFallbacks, notesAbout } from '../../web/src/play/notes.js';
import { buildSoloCast, HUMAN_MODEL, nameProblem, parseModels, runSolo } from '../../web/src/play/solo.js';
import { logFrom } from '../helpers/logs.js';

/** Answers every prompt the way a patient person would: the first option, a short speech, a reason. */
const autoAnswer = async (req: PromptRequest): Promise<HumanAnswer> => {
  const spec = formFor(req.phase, req.options);
  return { ...emptyAnswer(), speech: spec.speechLabel ? 'I speak.' : '', message: spec.messageLabel ? 'because' : '', note: 'MYNOTE', choice: spec.choices[0]!.value };
};

describe('nameProblem', () => {
  it('accepts a plain name and rejects anything else', () => {
    for (const ok of ['You', 'Sam', "O'Neil", 'Anne-Marie', 'Zoë', 'Player 1']) expect(nameProblem(ok), ok).toBeNull();
    const bad: [string, string][] = [['', 'Enter a name'], [' Sam', 'Enter a name'], ['Sam ', 'Enter a name'], ['x'.repeat(21), '20 characters'], ['<b>', 'letters, numbers'], ['-Sam', 'letters, numbers'], ['aria', "AI's name"], ['BRAM', "AI's name"]];
    for (const [name, why] of bad) expect(nameProblem(name), name).toContain(why);
  });
});

describe('parseModels', () => {
  const seven = Array.from({ length: 7 }, (_, i) => `vendor/model-${i + 1}`);
  it('reads seven model IDs from lines or commas', () => {
    expect(parseModels(seven.join('\n'))).toEqual({ ok: true, models: seven });
    expect(parseModels(seven.join(', '))).toEqual({ ok: true, models: seven });
    expect(parseModels(`\n${seven.join('\n\n')}\n`)).toEqual({ ok: true, models: seven });
  });
  it('says what is wrong', () => {
    expect(parseModels(seven.slice(0, 6).join('\n'))).toEqual({ ok: false, message: 'Enter 7 model IDs (one per line); you entered 6.' });
    expect(parseModels([...seven.slice(0, 6), 'two words'].join('\n'))).toMatchObject({ ok: false, message: expect.stringContaining('has a space') });
  });
});

describe('buildSoloCast', () => {
  it('has eight seats with the human among seven AIs, the position set by the seed', () => {
    const a = buildSoloCast('Sam', null, 0);
    expect(a).toHaveLength(8);
    expect(a.filter((c) => c.model === HUMAN_MODEL)).toEqual([{ name: 'Sam', model: 'human' }]);
    expect(a[0]!.name).toBe('Sam');
    expect(buildSoloCast('Sam', null, 3)[3]!.name).toBe('Sam');
    expect(buildSoloCast('Sam', null, 11)[3]!.name).toBe('Sam'); // 11 % 8
    expect(new Set(a.map((c) => c.name)).size).toBe(8);
  });
  it('gives the AIs the models in order', () => {
    const models = Array.from({ length: 7 }, (_, i) => `v/m${i}`);
    const cast = buildSoloCast('Sam', models, 2);
    expect(cast.filter((c) => c.model !== 'human').map((c) => c.model)).toEqual(models);
  });
});

describe('runSolo with mock AIs', () => {
  const setup = { humanName: 'Sam', seed: 5, ai: { kind: 'mock' as const } };

  it('plays a whole game: the human is a seat with model "human", answers are used, nothing falls back', async () => {
    const asked: PromptRequest[] = [];
    const log = await runSolo(setup, async (r) => (asked.push(r), autoAnswer(r)));
    expect(log.cast).toHaveLength(8);
    expect(log.cast.find((c) => c.name === 'Sam')).toEqual({ name: 'Sam', model: 'human' });
    const mine = log.turns.filter((t) => t.player === 'Sam');
    expect(mine.length).toBeGreaterThan(2);
    expect(asked).toHaveLength(mine.length);
    expect(mine.every((t) => !t.fallback && t.private_notes === 'MYNOTE')).toBe(true);
    expect(log.result.reason).toBeTruthy();
  });

  it('never shows the human anyone else\'s private notes, or their own earlier ones', async () => {
    const asked: PromptRequest[] = [];
    await runSolo(setup, async (r) => (asked.push(r), autoAnswer(r)));
    expect(asked.length).toBeGreaterThan(2);
    for (const r of asked) {
      expect(r.user).not.toContain('MOCKNOTE');
      expect(r.user).not.toContain('MYNOTE');
    }
  });

  it('is repeatable: the same seed and the same answers give the same log', async () => {
    const a = await runSolo(setup, autoAnswer);
    const b = await runSolo(setup, autoAnswer);
    expect(b).toEqual(a);
  });

  it('rejects a bad name, a bad cap and real models without a key or seven models', async () => {
    await expect(runSolo({ ...setup, humanName: 'Aria' }, autoAnswer)).rejects.toThrow("already an AI's name");
    await expect(runSolo({ ...setup, maxCostUsd: 0 }, autoAnswer)).rejects.toThrow('spend cap');
    await expect(runSolo({ ...setup, ai: { kind: 'openrouter', apiKey: ' ', models: Array(7).fill('v/m') } }, autoAnswer)).rejects.toThrow('need a key');
    await expect(runSolo({ ...setup, ai: { kind: 'openrouter', apiKey: 'k', models: ['v/m'] } }, autoAnswer)).rejects.toThrow('7 model IDs');
  });
});

describe('runSolo with real models (stubbed fetch)', () => {
  const KEY = 'sk-test-not-a-real-key';
  const models = Array.from({ length: 7 }, (_, i) => `vendor/model-${i + 1}`);

  /** Every call costs 0.6 USD and returns text that is not a valid reply. */
  const stub = (calls: { url: string; auth: string | null; body: string }[]): typeof fetch =>
    (async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>).Authorization ?? null, body: String(init.body) });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'no json' } }], usage: { total_tokens: 10, cost: 0.6 } }), { status: 200 });
    }) as unknown as typeof fetch;

  it('stops at the spend cap, sends the key only to OpenRouter, and leaves it out of the log', async () => {
    const calls: { url: string; auth: string | null; body: string }[] = [];
    const log = await runSolo(
      { humanName: 'Sam', seed: 5, ai: { kind: 'openrouter', apiKey: ` ${KEY} `, models }, maxCostUsd: 1, fetchImpl: stub(calls) },
      autoAnswer,
    );
    expect(log.result).toMatchObject({ reason: 'cost_cap', winner: null });
    expect(log.result.costCap).toMatchObject({ maxUsd: 1 });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.url === 'https://openrouter.ai/api/v1/chat/completions' && c.auth === `Bearer ${KEY}`)).toBe(true);
    expect(calls.every((c) => !c.body.includes(KEY))).toBe(true);
    expect(JSON.stringify(log)).not.toContain(KEY);
    expect(log.cast.filter((c) => c.model !== 'human').map((c) => c.model).sort()).toEqual([...models].sort());
  });
});

describe('runSolo can be ended', () => {
  const KEY = 'sk-test-not-a-real-key';
  const models = Array.from({ length: 7 }, (_, i) => `vendor/model-${i + 1}`);

  /** A fake OpenRouter that always replies with something invalid, a little slowly, and counts every call. */
  const slowStub = (counter: { n: number }): typeof fetch =>
    ((_url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        counter.n++;
        const timer = setTimeout(
          () => resolve(new Response(JSON.stringify({ choices: [{ message: { content: 'no json' } }] }), { status: 200 })),
          15,
        );
        init.signal?.addEventListener('abort', () => (clearTimeout(timer), reject(new DOMException('aborted', 'AbortError'))));
      })) as unknown as typeof fetch;

  const setup = (counter: { n: number }) => ({
    humanName: 'Sam',
    seed: 5,
    ai: { kind: 'openrouter' as const, apiKey: KEY, models },
    fetchImpl: slowStub(counter),
  });

  it('stops all network calls when aborted, and the game then winds down by itself', async () => {
    const counter = { n: 0 };
    const controller = new AbortController();
    let asked = 0;
    let atAbort = -1;
    const game = runSolo(
      setup(counter),
      async (r) => {
        asked++;
        if (asked === 2) {
          atAbort = counter.n;
          controller.abort();
        }
        return autoAnswer(r);
      },
      controller.signal,
    );
    const log = await game; // it settles: nothing hangs after an abort
    expect(atAbort).toBeGreaterThan(0);
    expect(counter.n).toBe(atAbort); // not one request after the abort
    expect(log.turns.length).toBeGreaterThan(0);
  });

  it('stops even when the human is never asked again (a game the human is out of)', async () => {
    const counter = { n: 0 };
    const controller = new AbortController();
    let after = -1;
    const game = runSolo(
      setup(counter),
      async (r) => {
        // Hold the human's turn until the abort, as the page does when you quit: the page then releases the turn.
        await new Promise((resolve) => setTimeout(resolve, 5));
        return autoAnswer(r);
      },
      controller.signal,
    );
    setTimeout(() => {
      after = counter.n;
      controller.abort();
    }, 40);
    await game;
    expect(counter.n).toBe(after);
  });

  it('does not call out at all if it is aborted before it starts', async () => {
    const counter = { n: 0 };
    const controller = new AbortController();
    controller.abort();
    await runSolo(setup(counter), autoAnswer, controller.signal);
    expect(counter.n).toBe(0);
  });

  it('plays normally with a signal that is never aborted', async () => {
    const log = await runSolo({ humanName: 'Sam', seed: 5, ai: { kind: 'mock' } }, autoAnswer, new AbortController().signal);
    expect(log.turns.length).toBeGreaterThan(20);
    expect(log.turns.every((t) => !t.fallback)).toBe(true);
  });
});

describe('aiFallbacks', () => {
  it('counts the AIs\' turns with no valid reply, and leaves the human\'s turns out', () => {
    const log = logFrom({ Sam: 'faithful', A1: 'traitor', A2: 'faithful' }, [
      { r: 1, phase: 'vote', p: 'A1', action: { target: 'Sam' }, fb: true },
      { r: 1, phase: 'vote', p: 'A2', action: { target: 'Sam' } },
      { r: 1, phase: 'vote', p: 'Sam', action: { target: 'A1' }, fb: true },
    ]);
    expect(aiFallbacks(log, 'Sam')).toEqual({ turns: 2, fallbacks: 1 });
    expect(aiFallbacks(logFrom({ Sam: 'faithful' }, []), 'Sam')).toEqual({ turns: 0, fallbacks: 0 });
  });
});

describe('notesAbout', () => {
  const log = logFrom(
    { Sam: 'faithful', A1: 'traitor', A2: 'faithful' },
    [
      { r: 1, phase: 'round_table', p: 'A1', action: { suspect: 'Sam', reason: 'x' }, speech: 'Sam seems honest.', notes: 'Frame Sam as the traitor.' },
      { r: 1, phase: 'round_table', p: 'A2', action: { suspect: 'A1', reason: 'x' }, speech: 'Hm.', notes: 'I like Samantha.' },
      { r: 1, phase: 'round_table', p: 'Sam', action: { suspect: 'A1', reason: 'x' }, speech: 'A1 lies.', notes: 'Sam is me.' },
      { r: 2, phase: 'vote', p: 'A2', action: { target: 'A1' }, notes: 'Sam and I agree.' },
    ],
    {},
    { Sam: 'human', A1: 'vendor/a', A2: 'vendor/b' },
  );

  it('lists the AIs\' notes that name the human, in order, with who wrote them and what they said', () => {
    expect(notesAbout(log, 'Sam')).toEqual([
      { turnId: 0, round: 1, phase: 'round_table', player: 'A1', model: 'vendor/a', said: 'Sam seems honest.', thought: 'Frame Sam as the traitor.' },
      { turnId: 3, round: 2, phase: 'vote', player: 'A2', model: 'vendor/b', said: '', thought: 'Sam and I agree.' },
    ]);
  });

  it('matches whole names only and skips the human\'s own notes', () => {
    const names = notesAbout(log, 'Sam').map((n) => n.player);
    expect(names).not.toContain('Sam');
    expect(notesAbout(log, 'Samantha')).toHaveLength(1);
    expect(notesAbout(log, 'Nobody')).toEqual([]);
  });
});
