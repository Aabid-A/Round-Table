import { describe, expect, it } from 'vitest';
import { buildContext } from '../../src/log/highlights/context.js';
import { faithfulBannishedByMajority, finalReveal, recruitAccepted, traitorVotesTraitor, whispersToNightTarget, defendsNightTarget, savesNightTargetInRevote, notesContradictPraise } from '../../src/log/highlights/rules.js';
import { logFrom, type Spec } from '../helpers/logs.js';

const roles = { T1: 'traitor', T2: 'traitor', F1: 'faithful', F2: 'faithful', F3: 'faithful', F4: 'faithful' } as const;

describe('recruitAccepted', () => {
  const accepted = logFrom({ ...roles }, [
    { r: 1, phase: 'vote', p: 'F1', action: { target: 'T2' } },
    { r: 1, ev: { type: 'banishment', player: 'T2', role: 'traitor', method: 'majority' } },
    { r: 1, phase: 'recruit_choose', p: 'T1', action: { target: 'F3' } },
    { r: 1, phase: 'recruit_respond', p: 'F3', action: { accept: true }, speech: '', notes: 'Join them, then play both sides.' },
    { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F3', accepted: true } },
  ]);

  it('finds an accepted offer, from the offer to the answer, with the answer as the faces turn', () => {
    expect(recruitAccepted(buildContext(accepted))).toEqual([
      { rule: 'recruit_accepted', score: 90, title: "F3 accepts T1's offer and becomes a traitor", from: 1, to: 2, facesTurn: 2, round: 1 },
    ]);
  });

  it('ignores a refusal and a game with no offer', () => {
    const refused = logFrom({ ...roles }, [
      { r: 1, phase: 'recruit_choose', p: 'T1', action: { target: 'F3' } },
      { r: 1, phase: 'recruit_respond', p: 'F3', action: { accept: false } },
      { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F3', accepted: false } },
    ]);
    expect(recruitAccepted(buildContext(refused))).toEqual([]);
    expect(recruitAccepted(buildContext(logFrom({ ...roles }, [])))).toEqual([]);
  });
});

describe('faithfulBannishedByMajority', () => {
  const votes = [
    { voter: 'T1', target: 'F1' },
    { voter: 'T2', target: 'F1' },
    { voter: 'F2', target: 'F1' },
    { voter: 'F3', target: 'T1' },
  ];
  const specs = (role: 'faithful' | 'traitor', method: 'majority' | 'revote', who = 'F1'): Spec[] =>
    [
      ...votes.map((v) => ({ r: 2, phase: 'vote' as const, p: v.voter, action: { target: v.target } })),
      { r: 2, ev: { type: 'vote', stage: 'vote', votes, tally: { F1: 3, T1: 1 }, leaders: ['F1'] } },
      { r: 2, ev: { type: 'banishment', player: who, role, method } },
    ];

  it('finds a faithful banished by a majority and scores it by the share of votes', () => {
    const [h] = faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, specs('faithful', 'majority'))));
    expect(h).toMatchObject({ rule: 'faithful_banished_by_majority', from: 0, to: 3, round: 2, facesTurn: null });
    expect(h!.score).toBe(Math.round(55 + 0.75 * 30));
    expect(h!.title).toBe('F1, a faithful, is banished by a majority (3 of 4 votes)');
  });

  it('needs more than half of the votes: a top count of 2 of 5 is not a majority', () => {
    const five = [
      { voter: 'T1', target: 'F1' }, { voter: 'T2', target: 'F1' }, { voter: 'F2', target: 'F3' },
      { voter: 'F3', target: 'F2' }, { voter: 'F4', target: 'T1' },
    ];
    const plurality: Spec[] = [
      ...five.map((v) => ({ r: 1, phase: 'vote' as const, p: v.voter, action: { target: v.target } }) as Spec),
      { r: 1, ev: { type: 'vote', stage: 'vote', votes: five, tally: { F1: 2, F3: 1, F2: 1, T1: 1 }, leaders: ['F1'] } },
      { r: 1, ev: { type: 'banishment', player: 'F1', role: 'faithful', method: 'majority' } },
    ];
    expect(faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, plurality)))).toEqual([]);
    const half: Spec[] = plurality.map((s) => ('ev' in s && s.ev.type === 'vote' ? { ...s, ev: { ...s.ev, tally: { F1: 3 } } } : s));
    expect(faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, half)))).toHaveLength(1);
  });

  it('ignores a traitor, and a faithful decided by a revote', () => {
    expect(faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, specs('traitor', 'majority', 'T1'))))).toEqual([]);
    expect(faithfulBannishedByMajority(buildContext(logFrom({ ...roles }, specs('faithful', 'revote'))))).toEqual([]);
  });
});

describe('finalReveal', () => {
  it('covers the last turns and names the winner', () => {
    const log = logFrom(
      { ...roles },
      Array.from({ length: 6 }, (_, i) => ({ r: 3, phase: 'vote' as const, p: 'F1', action: { target: `T${(i % 2) + 1}` } })),
      { winner: 'faithful', reason: 'no_traitors', rounds: 3 },
    );
    expect(finalReveal(buildContext(log))).toEqual([
      { rule: 'final_reveal', score: 50, title: 'The final reveal: the faithfuls win (no traitors)', from: 3, to: 5, facesTurn: null, round: 3 },
    ]);
  });

  it('handles a short game and a stopped game', () => {
    expect(finalReveal(buildContext(logFrom({ ...roles }, [])))).toEqual([]);
    const one = logFrom({ ...roles }, [{ r: 1, phase: 'vote', p: 'F1', action: { target: 'T1' } }], { winner: null, reason: 'cost_cap' });
    expect(finalReveal(buildContext(one))[0]).toMatchObject({ from: 0, to: 0, title: 'The final reveal: no winner (cost cap)' });
  });
});

describe('traitorVotesTraitor', () => {
  const voteSpecs = (stage: 'vote' | 'revote', votes: { voter: string; target: string }[], round = 1): Spec[] => [
    ...votes.map((v) => ({ r: round, phase: stage, p: v.voter, action: { target: v.target }, notes: `note ${v.voter}` }) as Spec),
    { r: round, ev: { type: 'vote', stage, votes, tally: {}, leaders: [] } },
  ];

  it('finds a traitor voting for a fellow traitor, from their vote to the end of the stage', () => {
    const log = logFrom({ ...roles }, voteSpecs('vote', [
      { voter: 'F1', target: 'T1' },
      { voter: 'T1', target: 'T2' },
      { voter: 'F2', target: 'T2' },
    ]));
    expect(traitorVotesTraitor(buildContext(log))).toEqual([
      { rule: 'traitor_votes_traitor', score: 80, title: 'T1, a traitor, votes against fellow traitor T2', from: 1, to: 2, facesTurn: 1, round: 1 },
    ]);
  });

  it('says so for a revote', () => {
    const log = logFrom({ ...roles }, voteSpecs('revote', [{ voter: 'T2', target: 'T1' }, { voter: 'F1', target: 'T1' }]));
    expect(traitorVotesTraitor(buildContext(log))[0]?.title).toBe('T2, a traitor, votes against fellow traitor T1 in the revote');
  });

  it('ignores a traitor voting for a faithful, and a faithful voting for a traitor', () => {
    const log = logFrom({ ...roles }, voteSpecs('vote', [{ voter: 'T1', target: 'F1' }, { voter: 'F2', target: 'T1' }]));
    expect(traitorVotesTraitor(buildContext(log))).toEqual([]);
  });

  it('counts a recruit as a traitor once they have accepted', () => {
    const log = logFrom({ ...roles }, [
      { r: 1, phase: 'recruit_respond', p: 'F3', action: { accept: true } },
      { r: 1, ev: { type: 'recruit', offeredBy: 'T1', offeredTo: 'F3', accepted: true } },
      ...voteSpecs('vote', [{ voter: 'F3', target: 'T1' }, { voter: 'F1', target: 'T1' }], 2),
    ]);
    expect(traitorVotesTraitor(buildContext(log)).map((h) => h.title)).toEqual(['F3, a traitor, votes against fellow traitor T1']);
  });
});

describe('night-target rules', () => {
  // T1 proposed F1, T2 proposed F2; F2 was murdered, so F1 is the surviving target of T1.
  const night: Spec[] = [
    { r: 1, phase: 'night', p: 'T1', action: { target: 'F1' } },
    { r: 1, phase: 'night', p: 'T2', action: { target: 'F2' } },
    { r: 1, ev: { type: 'murder', victim: 'F2', proposals: [], method: 'random' } },
    { r: 1, ev: { type: 'breakfast', victim: 'F2', role: 'faithful' } },
  ];
  const whisperSpecs = (from: string, to: string): Spec[] => [
    { r: 1, phase: 'whispers', p: from, action: { to, message: 'psst' }, notes: 'keep them close' },
    { r: 1, ev: { type: 'whisper', from, to, message: 'psst' } },
  ];
  const table = (suspects: Record<string, string>): Spec[] =>
    Object.entries(suspects).map(([p, suspect]) => ({ r: 1, phase: 'round_table' as const, p, action: { suspect, reason: 'because' }, speech: 'hm' }));

  describe('whispersToNightTarget', () => {
    it('finds a traitor whispering to a player they proposed to murder who is still alive', () => {
      const log = logFrom({ ...roles }, [...night, ...whisperSpecs('T1', 'F1')]);
      expect(whispersToNightTarget(buildContext(log))).toEqual([
        { rule: 'whispers_to_night_target', score: 85, title: 'T1, a traitor, whispers to F1, whom they proposed to murder in round 1', from: 2, to: 2, facesTurn: 2, round: 1 },
      ]);
    });
    it('ignores a whisper to someone they never proposed, a faithful whispering, and a whisper to the victim', () => {
      expect(whispersToNightTarget(buildContext(logFrom({ ...roles }, [...night, ...whisperSpecs('T1', 'F3')])))).toEqual([]);
      expect(whispersToNightTarget(buildContext(logFrom({ ...roles }, [...night, ...whisperSpecs('F3', 'F1')])))).toEqual([]);
      expect(whispersToNightTarget(buildContext(logFrom({ ...roles }, [...night, ...whisperSpecs('T2', 'F2')])))).toEqual([]);
    });
  });

  describe('defendsNightTarget', () => {
    it('finds a traitor accusing the player who accuses their night target', () => {
      const log = logFrom({ ...roles }, [...night, ...table({ F3: 'F1', T1: 'F3' })]);
      const found = defendsNightTarget(buildContext(log));
      expect(found).toEqual([
        { rule: 'defends_night_target', score: 70, title: 'T1, a traitor, accuses F3 for suspecting F1, whom they proposed to murder in round 1', from: 3, to: 3, facesTurn: 3, round: 1 },
      ]);
    });
    it('ignores a traitor who accuses someone unrelated, or whose target is dead', () => {
      expect(defendsNightTarget(buildContext(logFrom({ ...roles }, [...night, ...table({ F3: 'F1', T1: 'F4' })])))).toEqual([]);
      expect(defendsNightTarget(buildContext(logFrom({ ...roles }, [...night, ...table({ F3: 'F2', T2: 'F3' })])))).toEqual([]);
    });
  });

  describe('savesNightTargetInRevote', () => {
    const revote = (votes: { voter: string; target: string }[]): Spec[] => [
      { r: 1, ev: { type: 'vote', stage: 'vote', votes: [], tally: {}, leaders: ['F1', 'F3'] } },
      ...votes.map((v) => ({ r: 1, phase: 'revote' as const, p: v.voter, action: { target: v.target } }) as Spec),
      { r: 1, ev: { type: 'vote', stage: 'revote', votes, tally: {}, leaders: [] } },
    ];
    it('finds a traitor voting for the other tied player, saving their night target', () => {
      const log = logFrom({ ...roles }, [...night, ...revote([{ voter: 'T1', target: 'F3' }, { voter: 'F4', target: 'F1' }])]);
      expect(savesNightTargetInRevote(buildContext(log))).toEqual([
        { rule: 'saves_night_target_in_revote', score: 88, title: 'T1, a traitor, votes against F3 in the revote, saving F1, whom they proposed to murder in round 1', from: 2, to: 3, facesTurn: 2, round: 1 },
      ]);
    });
    it('ignores a traitor who votes for their own night target, and a tie that does not include it', () => {
      expect(savesNightTargetInRevote(buildContext(logFrom({ ...roles }, [...night, ...revote([{ voter: 'T1', target: 'F1' }])])))).toEqual([]);
      const other = logFrom({ ...roles }, [...night,
        { r: 1, ev: { type: 'vote', stage: 'vote', votes: [], tally: {}, leaders: ['F3', 'F4'] } },
        { r: 1, phase: 'revote', p: 'T1', action: { target: 'F3' } },
        { r: 1, ev: { type: 'vote', stage: 'revote', votes: [{ voter: 'T1', target: 'F3' }], tally: {}, leaders: [] } }]);
      expect(savesNightTargetInRevote(buildContext(other))).toEqual([]);
    });
  });
});

describe('notesContradictPraise', () => {
  const turnWith = (speech: string, notes: string, who = 'T1'): Spec[] => [
    { r: 1, phase: 'round_table', p: who, action: { suspect: 'F3', reason: 'x' }, speech, notes },
  ];
  const find = (speech: string, notes: string, who?: string) =>
    notesContradictPraise(buildContext(logFrom({ ...roles }, turnWith(speech, notes, who))));

  it('finds praise out loud against scheming in the notes, with the higher score', () => {
    expect(find('I trust F1 completely, they are honest.', 'I will frame F1 and make F1 my target.')).toEqual([
      { rule: 'notes_contradict_praise', score: 85, title: 'T1 praises F1 out loud, but their private notes scheme against F1', from: 0, to: 0, facesTurn: 0, round: 1 },
    ]);
  });

  it('still finds praise when the notes only name the player, with the lower score', () => {
    const [h] = find('I vouch for F1.', 'F1 seems easy to read.');
    expect(h).toMatchObject({ score: 75, title: 'T1 praises F1 out loud, but their private notes name F1' });
  });

  it('needs the praise and the name in the same sentence of the speech, and the name in the notes', () => {
    expect(find('I trust my gut. F1 spoke late.', 'F1 is a target.')).toEqual([]);
    expect(find('I trust F1.', 'Keep my head down.')).toEqual([]);
    expect(find('F1 looks suspicious to me.', 'F1 is a target.')).toEqual([]);
  });

  it('does not match a name inside another word, or the speaker praising themselves', () => {
    expect(find('I trust F10 completely.', 'F1 is my target.')).toEqual([]);
    expect(find('I trust T1, honestly.', 'T1 is me.', 'T1')).toEqual([]);
  });

  it('does not count a clause about someone else, or a negated one, as praise', () => {
    expect(find('I trust F1, but F2 is lying to us.', 'F2 is a traitor.')).toEqual([]);
    expect(find('I trust F1, but F2 is lying to us.', 'F1 is a target.').map((h) => h.title)).toHaveLength(1);
    expect(find('I do not trust F1.', 'F1 is a target.')).toEqual([]);
    expect(find("F1 isn't honest.", 'F1 is a target.')).toEqual([]);
    expect(find('F1 is not innocent at all.', 'F1 is a target.')).toEqual([]);
  });

  it('matches names as written: a cast name that is also a word, and names in other alphabets', () => {
    const ctxFor = (name: string, speech: string, notes: string) =>
      notesContradictPraise(buildContext(logFrom({ [name]: 'faithful', T1: 'traitor' }, turnWith(speech, notes))));
    expect(ctxFor('Will', 'I trust that it will work.', 'Will is my target.')).toEqual([]);
    expect(ctxFor('Will', 'I trust Will.', 'Will is my target.')).toHaveLength(1);
    expect(ctxFor('Zoë', 'I trust Zoëlle.', 'Zoë is my target.')).toEqual([]);
    expect(ctxFor('Zoë', 'I trust Zoë.', 'Zoë is my target.')).toHaveLength(1);
    expect(ctxFor('Émile', 'I vouch for Émile.', 'Émile is my target.')).toHaveLength(1);
  });

  it('finds a player whose name has a comma or colon, or is a word like Yet or No', () => {
    const praised = (name: string) =>
      notesContradictPraise(buildContext(logFrom({ [name]: 'faithful', T1: 'traitor' }, turnWith(`I trust ${name} fully.`, `${name} is my target.`))));
    for (const name of ['a:b', 'Smith, John', 'Yet', 'No', 'Nor', 'Though']) expect(praised(name), name).toHaveLength(1);
  });

  it('still skips a negated clause and a clause about someone else for such names', () => {
    const neg = logFrom({ No: 'faithful', T1: 'traitor' }, turnWith('I do not trust No.', 'No is my target.'));
    expect(notesContradictPraise(buildContext(neg))).toEqual([]);
    const other = logFrom({ 'Smith, John': 'faithful', F2: 'faithful', T1: 'traitor' }, turnWith('I trust F2, but Smith, John is lying.', 'Smith, John is a traitor.'));
    expect(notesContradictPraise(buildContext(other)).map((h) => h.title)).toEqual([]);
  });

  it('finds several players praised in one turn, and handles names with punctuation safely', () => {
    expect(find('I trust F1. I also vouch for F2.', 'F1 is a target. F2 is a lie.').map((h) => h.title)).toHaveLength(2);
    const odd = logFrom({ 'A.B': 'faithful', T1: 'traitor' }, turnWith('I trust A.B fully.', 'A.B is my target.'));
    expect(notesContradictPraise(buildContext(odd))).toHaveLength(1);
    const aXb = logFrom({ AxB: 'faithful', T1: 'traitor' }, turnWith('I trust A.B fully.', 'AxB is my target.'));
    expect(notesContradictPraise(buildContext(aXb))).toEqual([]);
  });
});

describe('night proposals that count', () => {
  const base = (night: Spec[], extra: Spec[]) => buildContext(logFrom({ ...roles }, [...night, ...extra]));
  const twoWay: Spec[] = [{ r: 1, ev: { type: 'vote', stage: 'vote', votes: [], tally: {}, leaders: ['F1', 'F3'] } }];
  const threeWay: Spec[] = [{ r: 1, ev: { type: 'vote', stage: 'vote', votes: [], tally: {}, leaders: ['F1', 'F3', 'F4'] } }];
  const revoteTurn = (leadersSpec: Spec[]): Spec[] => [
    ...leadersSpec,
    { r: 1, phase: 'revote', p: 'T1', action: { target: 'F3' } },
    { r: 1, ev: { type: 'vote', stage: 'revote', votes: [{ voter: 'T1', target: 'F3' }], tally: {}, leaders: [] } },
  ];

  it('ignores a first-pass proposal that the traitor replaced in the second pass', () => {
    const replaced: Spec[] = [
      { r: 1, phase: 'night', p: 'T1', action: { target: 'F1' } },
      { r: 1, phase: 'night', p: 'T2', action: { target: 'F2' } },
      { r: 1, phase: 'night', p: 'T1', action: { target: 'F2' } }, // T1 switched to F2 in the second pass
      { r: 1, phase: 'night', p: 'T2', action: { target: 'F2' } },
      { r: 1, ev: { type: 'murder', victim: 'F2', proposals: [], method: 'agreed' } },
      { r: 1, ev: { type: 'breakfast', victim: 'F2', role: 'faithful' } },
    ];
    const ctx = base(replaced, [
      { r: 1, phase: 'whispers', p: 'T1', action: { to: 'F1', message: 'hi' } },
      { r: 1, ev: { type: 'whisper', from: 'T1', to: 'F1', message: 'hi' } },
    ]);
    expect([...ctx.nightTargets('T1', 1)]).toEqual([['F2', 1]]);
    expect(whispersToNightTarget(ctx)).toEqual([]);
  });

  it('says which round the proposal was in when it was an earlier night', () => {
    const log = logFrom({ ...roles }, [
      { r: 1, phase: 'night', p: 'T1', action: { target: 'F1' } },
      { r: 1, ev: { type: 'murder', victim: 'F1', proposals: [], method: 'agreed' } },
      { r: 2, phase: 'night', p: 'T1', action: { target: 'F4' } },
      { r: 2, phase: 'whispers', p: 'T1', action: { to: 'F3', message: 'x' } },
      { r: 2, ev: { type: 'whisper', from: 'T1', to: 'F3', message: 'x' } },
      { r: 3, phase: 'night', p: 'T1', action: { target: 'F3' } },
      { r: 4, phase: 'whispers', p: 'T1', action: { to: 'F3', message: 'y' } },
      { r: 4, ev: { type: 'whisper', from: 'T1', to: 'F3', message: 'y' } },
    ]);
    expect(whispersToNightTarget(buildContext(log)).map((h) => h.title)).toEqual([
      'T1, a traitor, whispers to F3, whom they proposed to murder in round 3',
    ]);
  });

  it('counts a revote as a save only in a two-way tie', () => {
    const night: Spec[] = [{ r: 1, phase: 'night', p: 'T1', action: { target: 'F1' } }];
    expect(savesNightTargetInRevote(base(night, revoteTurn(twoWay)))).toHaveLength(1);
    expect(savesNightTargetInRevote(base(night, revoteTurn(threeWay)))).toEqual([]);
  });
});
