import type { Phase } from '../types.js';
import type { Action } from './types.js';

export interface ParsedReply {
  speech: string;
  private_notes: string;
  action: Action;
}

export type ParseResult = { ok: true; reply: ParsedReply } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const show = (v: unknown): string => JSON.stringify(typeof v === 'string' ? v.slice(0, 40) : v) ?? 'undefined';

function stripFences(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? (m[1] as string) : t;
}

/** Validate and normalise an action for a phase. Returns the action or an error string. */
export function validateAction(phase: Phase, raw: unknown, options: string[]): { action: Action } | { error: string } {
  if (!isRecord(raw)) return { error: '"action" must be an object' };
  const target = (field: string): { value: string } | { error: string } => {
    const v = raw[field];
    if (typeof v === 'string' && options.includes(v)) return { value: v };
    return { error: `"${field}" ${show(v)} is not a valid choice; valid choices: ${options.join(', ')}` };
  };
  switch (phase) {
    case 'night':
    case 'vote':
    case 'revote': {
      const t = target('target');
      return 'error' in t ? t : { action: { target: t.value } };
    }
    case 'round_table': {
      const t = target('suspect');
      if ('error' in t) return t;
      if (typeof raw.reason !== 'string' || raw.reason.trim() === '') return { error: '"reason" must be a non-empty string' };
      return { action: { suspect: t.value, reason: raw.reason } };
    }
    case 'whispers': {
      if (raw.to === null) return { action: { to: null, message: '' } };
      const t = target('to');
      if ('error' in t) return { error: `${t.error} (use null to send no whisper)` };
      if (typeof raw.message !== 'string' || raw.message.trim() === '') return { error: '"message" must be a non-empty string' };
      return { action: { to: t.value, message: raw.message } };
    }
    case 'recruit_choose': {
      if (raw.target === null) return { action: { target: null } };
      const t = target('target');
      return 'error' in t ? { error: `${t.error} (use null to make no offer)` } : { action: { target: t.value } };
    }
    case 'recruit_respond':
      return typeof raw.accept === 'boolean' ? { action: { accept: raw.accept } } : { error: '"accept" must be true or false' };
    case 'endgame_vote':
      return raw.choice === 'end' || raw.choice === 'banish'
        ? { action: { choice: raw.choice } }
        : { error: '"choice" must be "end" or "banish"' };
  }
}

/** Parse a raw model reply. Error messages never echo the reply text or private_notes (they may quote a short invalid target, which only goes back to the same player). */
export function parseReply(phase: Phase, raw: string, options: string[]): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, error: 'reply is not valid JSON' };
  }
  if (!isRecord(json)) return { ok: false, error: 'reply must be a JSON object' };
  if (typeof json.speech !== 'string') return { ok: false, error: '"speech" must be a string' };
  if (typeof json.private_notes !== 'string') return { ok: false, error: '"private_notes" must be a string' };
  if (phase === 'round_table' && json.speech.trim() === '') return { ok: false, error: '"speech" must not be empty at the round table' };
  const result = validateAction(phase, json.action, options);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, reply: { speech: json.speech, private_notes: json.private_notes, action: result.action } };
}

/** Deterministic fallback when a player gives no valid reply. `index` varies the pick. */
export function fallbackAction(phase: Phase, options: string[], index: number): Action {
  const pick = (): string => options[index % options.length] as string;
  switch (phase) {
    case 'night':
    case 'vote':
    case 'revote':
      return { target: pick() };
    case 'round_table':
      return { suspect: pick(), reason: '' };
    case 'whispers':
      return { to: null, message: '' };
    case 'recruit_choose':
      return { target: null };
    case 'recruit_respond':
      return { accept: false };
    case 'endgame_vote':
      return { choice: 'banish' };
  }
}
