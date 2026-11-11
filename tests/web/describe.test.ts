import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import { describeStep, stepDurationMs } from '../../web/src/replay/describe.js';
import { buildSteps } from '../../web/src/replay/timeline.js';

const log = JSON.parse(readFileSync('tests/fixtures/sample-game.json', 'utf8')) as GameLog;
const steps = buildSteps(log);
const view = (pred: (s: (typeof steps)[number]) => boolean) => describeStep(steps.find(pred)!, log);

describe('describeStep', () => {
  it('gives every step something to show', () => {
    for (const s of steps) {
      const v = describeStep(s, log);
      expect(v.bubble !== null || v.card !== null, `${s.kind} ${s.section.title}`).toBe(true);
    }
  });

  it('puts a round table statement in a speech bubble with suspect and reason underneath', () => {
    const step = steps.find((s) => s.kind === 'turn' && s.turn.phase === 'round_table')!;
    const t = step.kind === 'turn' ? step.turn : (null as never);
    const v = describeStep(step, log);
    expect(v.speaker).toBe(t.player);
    expect(v.bubble).toEqual({ text: t.speech, kind: 'speech' });
    expect(v.rows[0]).toEqual({ label: 'Said', value: t.speech });
    expect(v.rows[1]).toEqual({ label: 'Suspects', value: (t.action as { suspect: string }).suspect });
    expect(v.notes).toBe(t.private_notes);
  });

  it('shows a whisper as a whisper bubble and "no whisper" as an action', () => {
    const sent = view((s) => s.kind === 'turn' && s.turn.phase === 'whispers' && (s.turn.action as { to: unknown }).to !== null);
    expect(sent.bubble?.kind).toBe('whisper');
    expect(sent.rows[0]?.label).toBe('Whispers to');
    const none = view((s) => s.kind === 'turn' && s.turn.phase === 'whispers' && (s.turn.action as { to: unknown }).to === null);
    expect(none.bubble).toEqual({ text: 'Sends no whisper', kind: 'action' });
  });

  it('shows votes, tallies, murders, breakfast and banishments as cards', () => {
    const vote = view((s) => s.kind === 'event' && s.event.type === 'vote');
    expect(vote.card?.title).toBe('Vote result');
    expect(vote.tally.length).toBeGreaterThan(0);
    expect(vote.tally.map((x) => x.count)).toEqual([...vote.tally.map((x) => x.count)].sort((a, b) => b - a));
    expect(view((s) => s.kind === 'event' && s.event.type === 'murder').card?.tone).toBe('danger');
    expect(view((s) => s.kind === 'event' && s.event.type === 'breakfast').card?.body).toMatch(/was murdered in the night\. They were a (traitor|faithful)\./);
    expect(view((s) => s.kind === 'event' && s.event.type === 'banishment').card?.body).toMatch(/They were a (traitor|faithful)\./);
  });

  it('says so when a vote event has no leaders instead of printing undefined', () => {
    const step = steps.find((s) => s.kind === 'event' && s.event.type === 'vote')!;
    if (step.kind !== 'event' || step.event.type !== 'vote') throw new Error('expected a vote');
    const v = describeStep({ ...step, event: { ...step.event, leaders: [], tally: {} } }, log);
    expect(v.card?.body).toBe('No votes were cast.');
  });

  it('ends on a result card that names the winner and lists survivors', () => {
    const v = describeStep(steps.at(-1)!, log);
    expect(v.card?.title).toBe(`The ${log.result.winner}s win`);
    expect(v.rows).toHaveLength(log.result.survivors.length);
  });

  it('flags a fallback turn and says nothing about notes when there are none', () => {
    const step = steps.find((s) => s.kind === 'turn')!;
    if (step.kind !== 'turn') throw new Error('expected a turn');
    const copy = { ...step, turn: { ...step.turn, fallback: true, private_notes: '  ' } };
    const v = describeStep(copy, log);
    expect(v.fallback).toBe(true);
    expect(v.notes).toBeNull();
  });
});

describe('stepDurationMs', () => {
  it('is longer for longer text and stays within bounds', () => {
    const short = stepDurationMs({ ...describeStep(steps[0]!, log), bubble: { text: 'hi', kind: 'speech' }, card: null, rows: [] });
    const long = stepDurationMs({ ...describeStep(steps[0]!, log), bubble: { text: 'x'.repeat(100), kind: 'speech' }, card: null, rows: [] });
    const huge = stepDurationMs({ ...describeStep(steps[0]!, log), bubble: { text: 'x'.repeat(100000), kind: 'speech' }, card: null, rows: [] });
    expect(short).toBeGreaterThanOrEqual(1500);
    expect(long).toBeGreaterThan(short);
    expect(huge).toBe(9000);
  });
});
