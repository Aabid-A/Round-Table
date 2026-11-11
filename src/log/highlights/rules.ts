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

/** A faithful is banished by a straight majority. The bigger the share, the better the moment. */
export const faithfulBannishedByMajority: Rule = (ctx) =>
  ctx.events('banishment').flatMap((e) => {
    if (e.role !== 'faithful' || e.method !== 'majority') return [];
    const vote = [...ctx.events('vote')].reverse().find((v) => v.stage === 'vote' && v.round === e.round && v.afterTurn <= e.afterTurn);
    const first = ctx.stageTurns(e.round, 'vote')[0];
    if (!vote || !first) return [];
    const got = vote.tally[e.player] ?? 0;
    const share = vote.votes.length === 0 ? 0 : got / vote.votes.length;
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
