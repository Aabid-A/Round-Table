import type { Context } from './context.js';
import type { Highlight } from './types.js';

export type Rule = (ctx: Context) => Highlight[];

/** A recruit accepts: the offer and the answer, with the answer's private notes as the two-faces shot. */
export const recruitAccepted: Rule = (ctx) =>
  ctx.events('recruit').flatMap((e) => {
    if (!e.accepted) return [];
    const respond = ctx.turnById(e.afterTurn);
    const choose = [...ctx.log.turns].reverse().find(
      (t) => t.phase === 'recruit_choose' && t.player === e.offeredBy && t.id < e.afterTurn,
    );
    if (!respond) return [];
    return [
      {
        rule: 'recruit_accepted',
        score: 90,
        title: `${e.offeredTo} accepts ${e.offeredBy}'s offer and becomes a traitor`,
        from: choose?.id ?? respond.id,
        to: respond.id,
        facesTurn: respond.id,
        round: e.round,
      },
    ];
  });

/**
 * A faithful is banished by more than half of the votes. (The engine's method "majority" also covers a
 * plain top count with no revote, so the share is checked here.) The bigger the share, the better.
 */
export const faithfulBannishedByMajority: Rule = (ctx) =>
  ctx.events('banishment').flatMap((e) => {
    if (e.role !== 'faithful' || e.method !== 'majority') return [];
    const vote = [...ctx.events('vote')].reverse().find((v) => v.stage === 'vote' && v.round === e.round && v.afterTurn <= e.afterTurn);
    const first = ctx.stageTurns(e.round, 'vote')[0];
    if (!vote || !first) return [];
    const got = vote.tally[e.player] ?? 0;
    if (got * 2 <= vote.votes.length) return [];
    const share = got / vote.votes.length;
    return [
      {
        rule: 'faithful_banished_by_majority',
        score: Math.round(55 + share * 30),
        title: `${e.player}, a faithful, is banished by a majority (${got} of ${vote.votes.length} votes)`,
        from: first.id,
        to: e.afterTurn,
        facesTurn: null,
        round: e.round,
      },
    ];
  });

/** The last few turns and the result screen. */
export const finalReveal: Rule = (ctx) => {
  const last = ctx.log.turns.length - 1;
  if (last < 0) return [];
  const r = ctx.log.result;
  const outcome = r.winner === null ? 'no winner' : `the ${r.winner}s win`;
  return [
    {
      rule: 'final_reveal',
      score: 50,
      title: `The final reveal: ${outcome} (${r.reason.replace(/_/g, ' ')})`,
      from: Math.max(0, last - 2),
      to: last,
      facesTurn: null,
      round: r.rounds,
    },
  ];
};

/** A traitor votes against a fellow traitor, in the vote or the revote. */
export const traitorVotesTraitor: Rule = (ctx) =>
  ctx.events('vote').flatMap((e) => {
    const stageTurns = ctx.stageTurns(e.round, e.stage);
    const last = stageTurns.at(-1);
    return e.votes.flatMap((v) => {
      const turn = stageTurns.find((t) => t.player === v.voter);
      if (!turn || !last || v.voter === v.target) return [];
      if (!ctx.isTraitorAt(v.voter, turn.id) || !ctx.isTraitorAt(v.target, turn.id)) return [];
      return [
        {
          rule: 'traitor_votes_traitor' as const,
          score: 80,
          title: `${v.voter}, a traitor, votes against fellow traitor ${v.target}${e.stage === 'revote' ? ' in the revote' : ''}`,
          from: turn.id,
          to: last.id,
          facesTurn: turn.id,
          round: e.round,
        },
      ];
    });
  });

/**
 * The round in which the traitor finally proposed to murder this player, if they did and the
 * player is still in the game at `turnId`. Null otherwise.
 */
const markedInRound = (ctx: Context, traitor: string, target: string, round: number, turnId: number): number | null => {
  if (traitor === target || ctx.isOutAt(target, turnId)) return null;
  return ctx.nightTargets(traitor, round).get(target) ?? null;
};

const proposed = (round: number): string => `whom they proposed to murder in round ${round}`;

/** A traitor whispers to a player they proposed to murder and who is still alive. */
export const whispersToNightTarget: Rule = (ctx) =>
  ctx.events('whisper').flatMap((e) => {
    const turn = ctx.turnsOf(e.round, 'whispers').find((t) => t.player === e.from);
    const marked = turn ? markedInRound(ctx, e.from, e.to, e.round, turn.id) : null;
    if (!turn || marked === null || !ctx.isTraitorAt(e.from, turn.id)) return [];
    return [
      {
        rule: 'whispers_to_night_target' as const,
        score: 85,
        title: `${e.from}, a traitor, whispers to ${e.to}, ${proposed(marked)}`,
        from: turn.id,
        to: turn.id,
        facesTurn: turn.id,
        round: e.round,
      },
    ];
  });

/** At the round table a traitor accuses someone who is accusing a player the traitor proposed to murder. */
export const defendsNightTarget: Rule = (ctx) => {
  const out: Highlight[] = [];
  const rounds = [...new Set(ctx.log.turns.filter((t) => t.phase === 'round_table').map((t) => t.round))];
  for (const round of rounds) {
    const turns = ctx.turnsOf(round, 'round_table');
    const suspectOf = new Map(turns.map((t) => [t.player, (t.action as { suspect: string }).suspect]));
    for (const t of turns) {
      const accused = suspectOf.get(t.player) as string;
      if (!ctx.isTraitorAt(t.player, t.id)) continue;
      const protectedPlayer = suspectOf.get(accused);
      if (protectedPlayer === undefined || protectedPlayer === accused) continue;
      const marked = markedInRound(ctx, t.player, protectedPlayer, round, t.id);
      if (marked === null) continue;
      out.push({
        rule: 'defends_night_target',
        score: 70,
        title: `${t.player}, a traitor, accuses ${accused} for suspecting ${protectedPlayer}, ${proposed(marked)}`,
        from: t.id,
        to: t.id,
        facesTurn: t.id,
        round,
      });
    }
  }
  return out;
};

/** In a revote a traitor votes for the other tied player, saving a player they proposed to murder. */
export const savesNightTargetInRevote: Rule = (ctx) =>
  ctx.events('vote').flatMap((e) => {
    if (e.stage !== 'revote') return [];
    const first = [...ctx.events('vote')].reverse().find((v) => v.stage === 'vote' && v.round === e.round && v.afterTurn < e.afterTurn);
    const stage = ctx.stageTurns(e.round, 'revote');
    const last = stage.at(-1);
    if (!first || !last) return [];
    return e.votes.flatMap((v) => {
      const turn = stage.find((t) => t.player === v.voter);
      if (!turn || !ctx.isTraitorAt(v.voter, turn.id)) return [];
      // Only a two-way tie has a clear "save": voting for the other tied player decides it against them.
      if (first.leaders.length !== 2) return [];
      return first.leaders
        .filter((p) => p !== v.target)
        .flatMap((p) => {
          const marked = markedInRound(ctx, v.voter, p, e.round, turn.id);
          if (marked === null) return [];
          return [
            {
              rule: 'saves_night_target_in_revote' as const,
              score: 88,
              title: `${v.voter}, a traitor, votes against ${v.target} in the revote, saving ${p}, ${proposed(marked)}`,
              from: turn.id,
              to: last.id,
              facesTurn: turn.id,
              round: e.round,
            },
          ];
        });
    });
  });

const PRAISE =
  /\b(trust(?:s|ed)?|honest|innocent|loyal|vouch(?:es)?|believe(?:s)? in|support(?:s)?|ally|allies|good (?:person|player|faithful)|clearly (?:a )?faithful|on our side|has my vote|above suspicion)\b/i;
const SCHEMING =
  /\b(target(?:s|ed)?|eliminat\w*|suspect(?:s|ed)?|traitor|lie[sd]?|lying|decei\w*|mislead\w*|fram\w*|blame|sacrific\w*|throw|betray\w*|manipulat\w*|expendable)\b/i;

const NEGATION = /\b(?:not|never|no|nor|cannot|hardly)\b|n't\b/i;

const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+|\n/);
/** Parts of a sentence that can praise different people: split at commas, colons and "but"-like words. */
const clauses = (sentence: string): string[] => sentence.split(/[,;:]|\b(?:but|however|although|though|yet)\b/i);

const nameRegex = (name: string, flags = 'u'): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, flags);

/** The name as a whole word, case-sensitive (so "Will" is not "will"), with letters from any alphabet. */
const mentions = (text: string, name: string): boolean => nameRegex(name).test(text);

const MARK = '\u0001';

/**
 * A clause praises the player if it names them, has a praise word, and is not negated ("I do not trust Bo").
 * The name is masked first, so a cast name like "Smith, John" or "Yet" is not split or read as a keyword.
 */
const praisesInClause = (speech: string, name: string): boolean =>
  sentences(speech.replace(nameRegex(name, 'gu'), MARK)).some((s) =>
    clauses(s).some((c) => c.includes(MARK) && PRAISE.test(c) && !NEGATION.test(c)),
  );

/**
 * The speech praises a player and the same turn's private notes name them, most of all when the notes scheme
 * against them. Keyword based: it looks at one clause at a time and skips negated ones, but it can still be fooled
 * by sarcasm or praise words used another way.
 */
export const notesContradictPraise: Rule = (ctx) => {
  const out: Highlight[] = [];
  for (const t of ctx.log.turns) {
    if (t.speech.trim() === '' || t.private_notes.trim() === '') continue;
    for (const c of ctx.log.cast) {
      if (c.name === t.player) continue;
      if (!praisesInClause(t.speech, c.name) || !mentions(t.private_notes, c.name)) continue;
      const scheming = sentences(t.private_notes).some((s) => mentions(s, c.name) && SCHEMING.test(s));
      out.push({
        rule: 'notes_contradict_praise',
        score: scheming ? 85 : 75,
        title: `${t.player} praises ${c.name} out loud, but their private notes ${scheming ? 'scheme against' : 'name'} ${c.name}`,
        from: t.id,
        to: t.id,
        facesTurn: t.id,
        round: t.round,
      });
    }
  }
  return out;
};
