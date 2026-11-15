import { nameProblem, parseModels, type SoloSetup } from './solo.js';
import { seedFromSearch } from './params.js';

/** The setup's fields, checked: a setup to start, or what is wrong, in words. The seed comes from the address. */
export function checkSetup(f: { name: string; real: boolean; key: string; models: string; cap: string }): { ok: true; setup: SoloSetup } | { ok: false; message: string } {
  const nameError = nameProblem(f.name);
  if (nameError) return { ok: false, message: nameError };
  const seed = seedFromSearch(window.location.search);
  if (!f.real) return { ok: true, setup: { humanName: f.name, seed, ai: { kind: 'mock' } } };
  const parsed = parseModels(f.models);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  if (f.key.trim() === '') return { ok: false, message: 'Paste your OpenRouter key.' };
  const maxCostUsd = Number(f.cap);
  if (!(Number.isFinite(maxCostUsd) && maxCostUsd > 0)) return { ok: false, message: 'The spend cap must be a number above 0.' };
  return { ok: true, setup: { humanName: f.name, seed, ai: { kind: 'openrouter', apiKey: f.key, models: parsed.models }, maxCostUsd } };
}
