import { describe, expect, it } from 'vitest';
import { runGame } from '../../src/engine/game.js';
import { DEFAULT_SETTINGS } from '../../src/engine/types.js';
import { createMockPlayers, MOCK_CAST } from '../../src/players/mock.js';
import { buildPrompt } from '../../src/prompts/phases.js';
import { SYSTEM_PROMPT } from '../../src/prompts/system.js';
import { CANDLES } from '../../web/src/scene/world.js';
import { choosable, initial, reduce, stageMs, viewOf, type SliceState, type Stage } from '../../web/src/slice/machine.js';
import { scriptFromLog, SLICE_SEED, type SliceScript } from '../../web/src/slice/script.js';

const script: SliceScript = scriptFromLog(await runGame({ cast: MOCK_CAST, settings: DEFAULT_SETTINGS, seed: SLICE_SEED, players: createMockPlayers(MOCK_CAST, SLICE_SEED), buildPrompt, systemPrompt: SYSTEM_PROMPT }));

/** Play through: wait stages are advanced, the player's two choices are `accuse` and `vote`. Returns every state visited. */
function playThrough(accuse: number, vote: number): SliceState[] {
  const seen: SliceState[] = [];
  let s = initial();
  for (let i = 0; i < 80 && s.stage.kind !== 'end'; i++) {
    seen.push(s);
    if (s.stage.kind === 'accuse') s = reduce(reduce(s, { t: 'select', seat: accuse }, script), { t: 'confirm' }, script);
    else if (s.stage.kind === 'vote') s = reduce(reduce(s, { t: 'select', seat: vote }, script), { t: 'confirm' }, script);
    else s = reduce(s, { t: 'advance' }, script);
  }
  seen.push(s);
  return seen;
}

describe('the slice machine', () => {
  it('goes intro, the speeches with the player’s turn among them, the vote, the tally, the banishment, night, dawn, end', () => {
    const kinds = playThrough(2, 3).map((s) => s.stage.kind);
    const order: Stage['kind'][] = ['intro', 'speak', 'accuse', 'pointed', 'speak', 'vote', 'tally', 'banish', 'night', 'dawn', 'end'];
    const squashed = kinds.filter((k, i) => k !== kinds[i - 1]);
    expect(squashed).toEqual(order);
    expect(kinds.filter((k) => k === 'speak')).toHaveLength(7);
    expect(kinds.filter((k) => k === 'banish')).toHaveLength(3);
    expect(kinds.indexOf('accuse')).toBe(1 + script.yourTurnAfter);
  });

  it('waits for the player at the two choices only, and every other stage has a time', () => {
    const stages: Stage[] = [{ kind: 'intro' }, { kind: 'speak', i: 0 }, { kind: 'accuse' }, { kind: 'pointed' }, { kind: 'vote' }, { kind: 'tally' }, { kind: 'banish', step: 'pushback' }, { kind: 'banish', step: 'leave' }, { kind: 'banish', step: 'mask' }, { kind: 'night' }, { kind: 'dawn' }, { kind: 'end' }];
    expect(stages.filter((s) => stageMs(s) === null).map((s) => s.kind)).toEqual(['accuse', 'vote', 'end']);
    for (const s of stages) if (stageMs(s) !== null) expect(stageMs(s)!).toBeGreaterThan(1000);
    // A blocking animation never traps the player: nothing the player waits through is longer than a speech or a night.
    expect(Math.max(...stages.map((s) => stageMs(s) ?? 0))).toBeLessThanOrEqual(6000);
  });

  it('lets the player choose an AI at the table only, and only when it is their turn', () => {
    let s = initial();
    expect(choosable(s, script)).toEqual([]);
    expect(reduce(s, { t: 'select', seat: 2 }, script).selected).toBeNull();
    while (s.stage.kind !== 'accuse') s = reduce(s, { t: 'advance' }, script);
    expect(choosable(s, script)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(reduce(s, { t: 'select', seat: 0 }, script).selected).toBeNull(); // not yourself
    expect(reduce(s, { t: 'confirm' }, script).stage.kind).toBe('accuse'); // nothing chosen yet
    expect(reduce(reduce(s, { t: 'select', seat: 4 }, script), { t: 'confirm' }, script)).toMatchObject({ stage: { kind: 'pointed' }, accused: 4 });
    // In the room: selecting a figure chooses it, selecting another moves the choice, selecting the chosen one again confirms.
    const picked = reduce(s, { t: 'pick', seat: 4 }, script);
    expect(picked).toMatchObject({ stage: { kind: 'accuse' }, selected: 4 });
    expect(viewOf(picked, script).announce).toContain(`${script.players[4]!.name} is chosen`);
    expect(reduce(picked, { t: 'pick', seat: 5 }, script)).toMatchObject({ stage: { kind: 'accuse' }, selected: 5 });
    expect(reduce(picked, { t: 'pick', seat: 4 }, script)).toMatchObject({ stage: { kind: 'pointed' }, accused: 4 });
    expect(reduce(s, { t: 'pick', seat: 0 }, script).selected).toBeNull();
  });

  it('counts the player’s token in the banishment and shows who goes, whatever they choose', () => {
    for (let vote = 1; vote <= 7; vote++) {
      const end = playThrough(2, vote).at(-1)!;
      expect(end.vote).toBe(vote);
      expect(end.banished).not.toBeNull();
      expect(end.victim).not.toBeNull();
      expect(end.victim).not.toBe(end.banished);
      expect(end.victim).not.toBe(0);
    }
  });

  it('shows no role until the game has shown it: only the banished seat after the mask turns, and the dawn victim', () => {
    const roles = ['traitor', 'faithful'];
    for (const [accuse, vote] of [[1, 2], [4, 6], [7, 3]] as const) {
      for (const s of playThrough(accuse, vote)) {
        const v = viewOf(s, script);
        const revealed = v.figures.filter((f) => f.revealed !== null).map((f) => f.index);
        const allowed = new Set<number>();
        if (s.banished !== null && (s.stage.kind === 'night' || s.stage.kind === 'dawn' || s.stage.kind === 'end' || (s.stage.kind === 'banish' && s.stage.step === 'mask'))) allowed.add(s.banished);
        if (v.dawn) allowed.add(v.dawn.victim);
        expect(new Set(revealed), JSON.stringify(s.stage)).toEqual(allowed);
        if (s.stage.kind === 'banish' && s.stage.step !== 'mask') expect(v.banish?.role).toBeNull();
        // Nothing else in what the scene is given says a role: the words for the screen reader name one only when a mask is turned.
        const says = roles.some((r) => v.announce.includes(r));
        expect(says, `${s.stage.kind}: ${v.announce}`).toBe(v.figures.some((f) => f.revealed !== null) && (s.stage.kind === 'dawn' || (s.stage.kind === 'banish' && s.stage.step === 'mask')));
      }
    }
  });

  it('turns every figure toward the speaker, the speaker toward whom they accuse, the table toward whom the player points, and snuffs the candles at night', () => {
    const seen = playThrough(5, 3);
    const speaking = seen.find((s) => s.stage.kind === 'speak')!;
    const v = viewOf(speaking, script);
    const sp = script.speeches[(speaking.stage as { i: number }).i]!;
    expect(v.speaker).toBe(sp.speaker);
    expect(v.speech).toEqual({ text: sp.text, speaker: sp.speaker });
    expect(v.pointing).toEqual({ from: sp.speaker, at: sp.suspect });
    expect(v.looks[sp.speaker]).toBe(sp.suspect);
    expect(v.looks.filter((l, i) => i !== sp.speaker && l === sp.speaker)).toHaveLength(7);
    const pointed = viewOf(seen.find((s) => s.stage.kind === 'pointed')!, script);
    expect(pointed.pointing).toEqual({ from: 0, at: 5 });
    expect(pointed.looks.every((l) => l === 5)).toBe(true);
    expect(viewOf(seen[0]!, script).candlesLit).toBe(CANDLES);
    expect(viewOf(seen.find((s) => s.stage.kind === 'night')!, script).candlesLit).toBe(0);
    expect(viewOf(seen.find((s) => s.stage.kind === 'night')!, script).mood).toBe('night');
    expect(viewOf(seen.find((s) => s.stage.kind === 'dawn')!, script).mood).toBe('dawn');
  });

  it('puts tokens on the table once the votes are in and leaves them there, with the player’s among them', () => {
    const seen = playThrough(2, 6);
    expect(viewOf(seen.find((s) => s.stage.kind === 'vote')!, script).tokens).toEqual([]);
    const tally = viewOf(seen.find((s) => s.stage.kind === 'tally')!, script);
    expect(tally.tokens).toHaveLength(8);
    expect(tally.tokens).toContainEqual({ owner: 0, target: 6 });
    expect(viewOf(seen.find((s) => s.stage.kind === 'banish')!, script).tokens).toHaveLength(8);
  });

  it('removes the banished figure from the table and the dawn victim at dawn, leaving their masks', () => {
    const seen = playThrough(2, 3);
    const mid = viewOf(seen.find((s) => s.stage.kind === 'banish' && s.stage.step === 'leave')!, script);
    expect(mid.figures.filter((f) => !f.present)).toHaveLength(1);
    const dawn = viewOf(seen.find((s) => s.stage.kind === 'dawn')!, script);
    expect(dawn.figures.filter((f) => !f.present)).toHaveLength(2);
    expect(dawn.dawn?.victim).toBeGreaterThan(0);
    expect(dawn.banish?.stage).toBe('done');
  });

  it('starts again from the top', () => {
    expect(reduce(playThrough(1, 2).at(-1)!, { t: 'restart' }, script)).toEqual(initial());
  });
});

describe('a hover does not outlive the choice', () => {
  it('is cleared when a choice is confirmed and when a moment moves on', () => {
    let s: SliceState = initial();
    while (s.stage.kind !== 'accuse') s = reduce(s, { t: 'advance' }, script);
    s = reduce(reduce(s, { t: 'hover', seat: 2 }, script), { t: 'select', seat: 2 }, script);
    expect(s.hovered).toBe(2);
    s = reduce(s, { t: 'confirm' }, script);
    expect(s.stage.kind).toBe('pointed');
    expect(s.hovered).toBeNull();
    s = initial();
    while (s.stage.kind !== 'vote') s = reduce(s.stage.kind === 'accuse' ? reduce(s, { t: 'select', seat: 1 }, script) : s, s.stage.kind === 'accuse' ? { t: 'confirm' } : { t: 'advance' }, script);
    s = reduce(reduce(s, { t: 'hover', seat: 3 }, script), { t: 'select', seat: 3 }, script);
    expect(viewOf(reduce(s, { t: 'confirm' }, script), script).hovered).toBeNull();
  });
});

describe('slice prompts by input', () => {
  it('a touch screen is told to tap at both choices, and never about arrow keys or Enter', () => {
    const turns = playThrough(2, 3).filter((s) => s.stage.kind === 'accuse' || s.stage.kind === 'vote');
    expect(turns.length).toBeGreaterThan(1);
    for (const s of turns.flatMap((t) => [t, reduce(t, { t: 'select', seat: 4 }, script)])) {
      const touch = viewOf(s, script, 'touch').announce;
      expect(touch).toMatch(/tap/i);
      expect(touch).not.toMatch(/arrow|enter/i);
      expect(viewOf(s, script).announce).toMatch(/arrow keys|Enter/);
    }
  });
});
