import { describe, expect, it } from 'vitest';
import { renderEvent } from '../../src/prompts/history.js';
import { parseHistoryLine, newHistoryLines, newsToPlay, nightProposals } from '../../web/src/live/events.js';
import { parsePrompt } from '../../web/src/perspective/knowledge.js';
import { playMock } from '../helpers/game.js';

describe('parseHistoryLine', () => {
  it('reads back every kind of line the game writes for a player, from real games', async () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const log = await playMock(seed);
      for (const t of log.turns) {
        const k = parsePrompt(t.attempts[0]!.prompt)!;
        for (const line of k.history) {
          const e = parseHistoryLine(line);
          kinds.add(e.kind);
          // Nothing the game writes for a player is left unread except the lines that are genuinely other (votes read, recruit etc.).
          if (e.kind === 'other') expect(line, line).toMatch(/offered|End-or-banish|murdered \w+\.|Your pack/);
        }
      }
    }
    for (const k of ['speech', 'whisper_in', 'whisper_out', 'breakfast', 'votes', 'banished', 'round']) expect(kinds.has(k), k).toBe(true);
  });

  it('reads the fields', () => {
    expect(parseHistoryLine('Dax said "Let us not rush." and suspects Hugo because: they were quiet.')).toEqual({ kind: 'speech', player: 'Dax', text: 'Let us not rush.', suspect: 'Hugo', reason: 'they were quiet' });
    expect(parseHistoryLine('Dax said (said nothing) and suspects Hugo.')).toEqual({ kind: 'speech', player: 'Dax', text: '', suspect: 'Hugo', reason: '' });
    expect(parseHistoryLine('Bram whispered to you: "Trust me."')).toEqual({ kind: 'whisper_in', from: 'Bram', text: 'Trust me.' });
    expect(parseHistoryLine('You whispered to Cleo: "Hello."')).toEqual({ kind: 'whisper_out', to: 'Cleo', text: 'Hello.' });
    expect(parseHistoryLine('Breakfast: Esme was murdered in the night. They were a faithful.')).toEqual({ kind: 'breakfast', victim: 'Esme' });
    expect(parseHistoryLine('Breakfast: nobody was murdered.')).toEqual({ kind: 'breakfast', victim: null });
    expect(parseHistoryLine('Banishment vote: Aria -> Cleo, Bram -> Cleo.')).toEqual({ kind: 'votes', stage: 'vote', votes: [{ voter: 'Aria', target: 'Cleo' }, { voter: 'Bram', target: 'Cleo' }] });
    expect(parseHistoryLine('Hugo was banished. They were a faithful.')).toEqual({ kind: 'banished', player: 'Hugo' });
    expect(parseHistoryLine('-- Round 2 --')).toEqual({ kind: 'round', round: 2 });
  });

  it('reads the same lines renderEvent writes', () => {
    const line = renderEvent({ type: 'whisper', round: 1, afterTurn: 0, visibleTo: ['A', 'B'], from: 'A', to: 'B', message: 'psst' }, 'B');
    expect(parseHistoryLine(line)).toEqual({ kind: 'whisper_in', from: 'A', text: 'psst' });
  });
});

describe('newHistoryLines', () => {
  it('is what the newer prompt added, and everything when there was no earlier prompt or the history was rewritten', () => {
    expect(newHistoryLines(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
    expect(newHistoryLines(null, ['a'])).toEqual(['a']);
    expect(newHistoryLines(['a', 'x'], ['a', 'b'])).toEqual(['a', 'b']);
    expect(newHistoryLines(['a'], ['a'])).toEqual([]);
  });
  it('holds across the prompts of a real game: each prompt only adds lines', async () => {
    const log = await playMock(3);
    for (const name of log.cast.map((c) => c.name)) {
      let prev: string[] | null = null;
      for (const t of log.turns.filter((x) => x.player === name)) {
        const cur = parsePrompt(t.attempts[0]!.prompt)!.history;
        if (prev) expect(cur.slice(0, prev.length)).toEqual(prev);
        prev = cur;
      }
    }
  });
});

describe('nightProposals', () => {
  it('reads the other traitor’s proposals from a second-pass night prompt, and none from a first-pass one', () => {
    const second = 'You are A.\n\nWhat you know so far:\nx\n\nIt is night. Pick one faithful to murder.\nYour fellow traitors did not all pick the same target. Their proposals: A -> Dax, B -> Esme.\nThis is the last chance to agree.\nValid targets: Dax, Esme.';
    expect(nightProposals(second)).toEqual([{ by: 'A', target: 'Dax' }, { by: 'B', target: 'Esme' }]);
    expect(nightProposals('It is night. Pick one faithful to murder.\nValid targets: Dax.')).toEqual([]);
  });
  it('matches the prompt the game writes', async () => {
    let seen = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const log = await playMock(seed);
      for (const t of log.turns.filter((x) => x.phase === 'night')) {
        const got = nightProposals(t.attempts[0]!.prompt);
        if (got.length > 0) {
          seen++;
          for (const p of got) expect(log.cast.map((c) => c.name)).toContain(p.target);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('newsToPlay', () => {
  const lines = [
    '-- Round 1 --',
    'Breakfast: Esme was murdered in the night. They were a faithful.',
    'Bram said "One." and suspects Cleo.',
    'Sam said "Mine." and suspects Cleo.',
    'Cleo said "Two." and suspects Bram.',
    'Dax said "Three." and suspects Bram.',
    'Gwen said "Four." and suspects Bram.',
  ];
  it('skips your own words and the round markers', () => {
    const news = newsToPlay(null, lines, 'Sam', false);
    expect(news.map((e) => e.kind)).toEqual(['breakfast', 'speech', 'speech', 'speech', 'speech']);
    expect(news.some((e) => e.kind === 'speech' && e.player === 'Sam')).toBe(false);
  });
  it('after a reload plays only the latest three, not the whole game', () => {
    const news = newsToPlay(null, lines, 'Sam', true);
    expect(news).toHaveLength(3);
    expect(news.map((e) => (e.kind === 'speech' ? e.player : e.kind))).toEqual(['Cleo', 'Dax', 'Gwen']);
  });
  it('plays only what is new when the page has seen an earlier prompt', () => {
    expect(newsToPlay(lines.slice(0, 3), lines, 'Sam', false).map((e) => (e.kind === 'speech' ? e.player : e.kind))).toEqual(['Cleo', 'Dax', 'Gwen']);
  });
});
