import {
  addEvent,
  aliveFaithfuls,
  aliveNames,
  aliveTraitors,
  eventBase,
  getPlayer,
  viewFor,
} from './state.js';
import { tallyVotes } from './tally.js';
import { takeTurn, type EngineContext } from './turn.js';
import type {
  EndgameVoteAction,
  NightAction,
  RecruitChooseAction,
  RecruitRespondAction,
  RoundTableAction,
  VoteAction,
  WhisperAction,
} from './types.js';

type Proposal = { player: string; target: string };

/** Night: traitors agree on one murder. Returns the victim, or null if no one can be murdered. */
export async function runNight(ctx: EngineContext): Promise<string | null> {
  const { state, rng } = ctx;
  const traitors = aliveTraitors(state);
  const options = aliveFaithfuls(state);
  if (traitors.length === 0 || options.length === 0) {
    addEvent(state, { type: 'murder', ...eventBase(state, traitors), victim: null, proposals: [], method: 'none' });
    return null;
  }

  const propose = async (others: Proposal[] | null): Promise<Proposal[]> => {
    const out: Proposal[] = [];
    for (const player of traitors) {
      const seen = others === null ? null : others.filter((p) => p.player !== player);
      const turn = await takeTurn(ctx, { phase: 'night', view: viewFor(state, player), options, proposals: seen });
      out.push({ player, target: (turn.action as NightAction).target });
    }
    return out;
  };

  let proposals = await propose(null);
  const agreed = (ps: Proposal[]): boolean => ps.every((p) => p.target === ps[0]?.target);
  if (!agreed(proposals)) proposals = await propose(proposals);

  const isAgreed = agreed(proposals);
  const victim = isAgreed ? (proposals[0] as Proposal).target : rng.pick(proposals).target;
  getPlayer(state, victim).status = 'murdered';
  addEvent(state, {
    type: 'murder',
    ...eventBase(state, traitors),
    victim,
    proposals,
    method: isAgreed ? 'agreed' : 'random',
  });
  return victim;
}

export function runBreakfast(ctx: EngineContext, victim: string | null): void {
  const { state } = ctx;
  addEvent(state, {
    type: 'breakfast',
    ...eventBase(state, 'all'),
    victim,
    role: victim === null ? null : getPlayer(state, victim).role,
  });
}

/** Whispers are collected together and delivered afterwards. Only sender and recipient see one. */
export async function runWhispers(ctx: EngineContext): Promise<void> {
  const { state } = ctx;
  const players = aliveNames(state);
  const collected: { from: string; to: string; message: string }[] = [];
  for (const player of players) {
    const options = players.filter((n) => n !== player);
    const turn = await takeTurn(ctx, { phase: 'whispers', view: viewFor(state, player), options });
    const action = turn.action as WhisperAction;
    if (action.to !== null) collected.push({ from: player, to: action.to, message: action.message });
  }
  for (const w of collected) {
    addEvent(state, { type: 'whisper', ...eventBase(state, [w.from, w.to]), ...w });
  }
}

/** Round table: shuffled speaking order, each speaker sees earlier speeches this round. */
export async function runRoundTable(ctx: EngineContext): Promise<void> {
  const { state, rng } = ctx;
  const players = aliveNames(state);
  for (const player of rng.shuffle(players)) {
    const options = players.filter((n) => n !== player);
    const turn = await takeTurn(ctx, { phase: 'round_table', view: viewFor(state, player), options });
    const action = turn.action as RoundTableAction;
    addEvent(state, {
      type: 'speech',
      ...eventBase(state, 'all'),
      player,
      speech: turn.speech,
      suspect: action.suspect,
      reason: action.reason,
    });
  }
}

async function collectVotes(
  ctx: EngineContext,
  stage: 'vote' | 'revote',
  candidates: string[],
): Promise<{ voter: string; target: string }[]> {
  const { state } = ctx;
  const votes: { voter: string; target: string }[] = [];
  for (const voter of aliveNames(state)) {
    const options = candidates.filter((c) => c !== voter);
    const view = viewFor(state, voter);
    const turn =
      stage === 'vote'
        ? await takeTurn(ctx, { phase: 'vote', view, options })
        : await takeTurn(ctx, { phase: 'revote', view, options, tied: candidates });
    votes.push({ voter, target: (turn.action as VoteAction).target });
  }
  const tally = tallyVotes(votes, candidates);
  addEvent(state, { type: 'vote', ...eventBase(state, 'all'), stage, votes, tally: tally.counts, leaders: tally.leaders });
  return votes;
}

/** Banishment vote. Ties go to a revote between the tied players, then to the seeded RNG. */
export async function runBanishment(ctx: EngineContext): Promise<string> {
  const { state, rng } = ctx;
  const everyone = aliveNames(state);
  let tally = tallyVotes(await collectVotes(ctx, 'vote', everyone), everyone);
  let method: 'majority' | 'revote' | 'random' = 'majority';
  let banished = tally.leaders[0] as string;
  if (tally.leaders.length > 1) {
    const tied = tally.leaders;
    tally = tallyVotes(await collectVotes(ctx, 'revote', tied), tied);
    if (tally.leaders.length === 1) {
      method = 'revote';
      banished = tally.leaders[0] as string;
    } else {
      method = 'random';
      banished = rng.pick(tally.leaders);
    }
  }
  const player = getPlayer(state, banished);
  player.status = 'banished';
  addEvent(state, { type: 'banishment', ...eventBase(state, 'all'), player: banished, role: player.role, method });
  return banished;
}

/** If a traitor was banished and traitors remain, a surviving traitor may recruit a faithful. */
export async function runRecruitment(ctx: EngineContext, banished: string): Promise<void> {
  const { state, rng } = ctx;
  if (getPlayer(state, banished).role !== 'traitor') return;
  const traitors = aliveTraitors(state);
  const faithfuls = aliveFaithfuls(state);
  if (traitors.length === 0 || faithfuls.length === 0) return;

  const recruiter = rng.pick(traitors);
  const choose = await takeTurn(ctx, {
    phase: 'recruit_choose',
    view: viewFor(state, recruiter),
    options: faithfuls,
  });
  const target = (choose.action as RecruitChooseAction).target;
  if (target === null) return;

  const respond = await takeTurn(ctx, {
    phase: 'recruit_respond',
    view: viewFor(state, target),
    options: [],
    offeredBy: recruiter,
  });
  const accepted = (respond.action as RecruitRespondAction).accept;
  if (accepted) getPlayer(state, target).role = 'traitor';
  addEvent(state, {
    type: 'recruit',
    ...eventBase(state, [recruiter, target]),
    offeredBy: recruiter,
    offeredTo: target,
    accepted,
  });
}

/** Survivors vote to end the game or banish again. A strict majority for "end" ends it. */
export async function runEndgameVote(ctx: EngineContext): Promise<boolean> {
  const { state } = ctx;
  const voters = aliveNames(state);
  const votes: { voter: string; choice: 'end' | 'banish' }[] = [];
  for (const voter of voters) {
    const turn = await takeTurn(ctx, { phase: 'endgame_vote', view: viewFor(state, voter), options: [] });
    votes.push({ voter, choice: (turn.action as EndgameVoteAction).choice });
  }
  const end = votes.filter((v) => v.choice === 'end').length * 2 > voters.length;
  addEvent(state, { type: 'endgame_vote', ...eventBase(state, 'all'), votes, end });
  return end;
}
