import type { Phase } from '../types.js';
import type { Action } from './types.js';

export interface ParsedReply {
  speech: string;
  private_notes: string;
  action: Action;
}

export type ParseResult =
  | { ok: true; reply: ParsedReply; /** True when the JSON was taken from text around it. */ extracted: boolean }
  | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const show = (v: unknown): string => JSON.stringify(typeof v === 'string' ? v.slice(0, 40) : v) ?? 'undefined';

function stripFences(raw: string): string {
  const t = raw.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? (m[1] as string) : t;
}

const MAX_SCAN_CHARS = 200_000;
const MAX_RESTARTS = 100;

/** One pass from `from`: closed top-level {...} spans, plus the start of an unclosed one (or -1). */
function scanSpans(text: string, from: number): { spans: string[]; unclosedStart: number } {
  const spans: string[] = [];
  let depth = 0;
  let start = from;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (depth > 0 && inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0) spans.push(text.slice(start, i + 1));
    } else if (ch === '"' && depth > 0) {
      inString = true;
    }
  }
  return { spans, unclosedStart: depth > 0 ? start : -1 };
}

/**
 * Balanced top-level {...} spans in text, ignoring braces inside JSON strings.
 * A '{' that never closes (prose like "Note { I will vote") must not hide a later
 * object, so scanning restarts after it. Bounded so hostile replies cannot cost much.
 */
function objectSpans(raw: string): string[] {
  const text = raw.length > MAX_SCAN_CHARS ? raw.slice(0, MAX_SCAN_CHARS) : raw;
  const spans: string[] = [];
  let from = 0;
  for (let restarts = 0; restarts <= MAX_RESTARTS; restarts++) {
    const pass = scanSpans(text, from);
    spans.push(...pass.spans);
    if (pass.unclosedStart < 0) break;
    from = pass.unclosedStart + 1;
  }
  return spans;
}

type Decoded = { json: unknown; extracted: boolean } | { error: string };

/** Parse a reply as JSON; failing that, take the single JSON object written among other text. */
function decode(raw: string): Decoded {
  try {
    return { json: JSON.parse(stripFences(raw)), extracted: false };
  } catch {
    // Fall through: models often write a sentence before or after their JSON.
  }
  const objects: unknown[] = [];
  for (const span of objectSpans(raw)) {
    try {
      const value: unknown = JSON.parse(span);
      if (isRecord(value)) objects.push(value);
    } catch {
      // Not JSON: ignore this span.
    }
  }
  if (objects.length === 1) return { json: objects[0], extracted: true };
  return { error: objects.length === 0 ? 'reply is not valid JSON' : 'reply contains more than one JSON object' };
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
  const decoded = decode(raw);
  if ('error' in decoded) return { ok: false, error: decoded.error };
  const { json, extracted } = decoded;
  if (!isRecord(json)) return { ok: false, error: 'reply must be a JSON object' };
  if (typeof json.speech !== 'string') return { ok: false, error: '"speech" must be a string' };
  if (typeof json.private_notes !== 'string') return { ok: false, error: '"private_notes" must be a string' };
  if (phase === 'round_table' && json.speech.trim() === '') return { ok: false, error: '"speech" must not be empty at the round table' };
  const result = validateAction(phase, json.action, options);
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, extracted, reply: { speech: json.speech, private_notes: json.private_notes, action: result.action } };
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
