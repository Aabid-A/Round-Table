import type { PhaseRequest } from '../engine/types.js';
import { renderHistory, renderSituation } from './history.js';

type Req<P extends PhaseRequest['phase']> = Extract<PhaseRequest, { phase: P }>;

function frame(req: PhaseRequest, task: string): string {
  return `${renderSituation(req.view)}\n\nWhat you know so far:\n${renderHistory(req.view)}\n\n${task}`;
}

const names = (list: string[]): string => list.join(', ');

export function buildNightPrompt(req: Req<'night'>): string {
  const seen =
    req.proposals && req.proposals.length > 0
      ? `\nYour fellow traitors did not all pick the same target. Their proposals: ${req.proposals.map((p) => `${p.player} -> ${p.target}`).join(', ')}.\nThis is the last chance to agree; if you still differ, one proposal is picked at random.`
      : '';
  return frame(
    req,
    `It is night. Pick one faithful to murder.${seen}\nValid targets: ${names(req.options)}.\nUse "speech": "".\nAction: {"target": "<name>"}`,
  );
}

export function buildWhispersPrompt(req: Req<'whispers'>): string {
  return frame(
    req,
    `Whispers. You may send one private message to one player; only they will see it. Everyone chooses at the same time.\nValid recipients: ${names(req.options)}.\nUse "speech": "".\nAction: {"to": "<name>", "message": "<text>"} or {"to": null} to send nothing.`,
  );
}

export function buildRoundTablePrompt(req: Req<'round_table'>): string {
  return frame(
    req,
    `Round table. Speak to the table, then name one suspect and give a reason. Everyone sees what you say and who you suspect.\nValid suspects: ${names(req.options)}.\nAction: {"suspect": "<name>", "reason": "<text>"}`,
  );
}

export function buildVotePrompt(req: Req<'vote'>): string {
  return frame(
    req,
    `Banishment vote. Vote for the player to banish. Votes are revealed together afterwards.\nValid choices: ${names(req.options)}.\nUse "speech": "" or a short public remark.\nAction: {"target": "<name>"}`,
  );
}

export function buildRevotePrompt(req: Req<'revote'>): string {
  return frame(
    req,
    `Revote. The vote ended in a tie between ${names(req.tied)}. Vote again; you may only vote for one of them (not yourself).\nValid choices: ${names(req.options)}.\nAction: {"target": "<name>"}`,
  );
}

export function buildRecruitChoosePrompt(req: Req<'recruit_choose'>): string {
  return frame(
    req,
    `A traitor was banished, and you were chosen to act for the traitors. You may offer one faithful the chance to become a traitor, or make no offer.\nFaithfuls you can offer: ${names(req.options)}.\nUse "speech": "".\nAction: {"target": "<name>"} or {"target": null} for no offer.`,
  );
}

export function buildRecruitRespondPrompt(req: Req<'recruit_respond'>): string {
  return frame(
    req,
    `${req.offeredBy} secretly offers you a place among the traitors. If you accept, you become a traitor from now on and win with them. If you refuse, you stay faithful.\nUse "speech": "".\nAction: {"accept": true} or {"accept": false}`,
  );
}

export function buildEndgameVotePrompt(req: Req<'endgame_vote'>): string {
  return frame(
    req,
    `Few players remain. Vote to end the game now or banish again. A strict majority for "end" ends the game; if it ends, any surviving traitor means the traitors win.\nUse "speech": "" or a short public remark.\nAction: {"choice": "end"} or {"choice": "banish"}`,
  );
}

export function buildPrompt(req: PhaseRequest): string {
  switch (req.phase) {
    case 'night': return buildNightPrompt(req);
    case 'whispers': return buildWhispersPrompt(req);
    case 'round_table': return buildRoundTablePrompt(req);
    case 'vote': return buildVotePrompt(req);
    case 'revote': return buildRevotePrompt(req);
    case 'recruit_choose': return buildRecruitChoosePrompt(req);
    case 'recruit_respond': return buildRecruitRespondPrompt(req);
    case 'endgame_vote': return buildEndgameVotePrompt(req);
  }
}
