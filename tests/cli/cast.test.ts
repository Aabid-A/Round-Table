import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCast } from '../../src/cli/cast.js';

const eight = (model = 'vendor/m'): { name: string; model: string }[] =>
  Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, model }));

describe('parseCast', () => {
  it('accepts eight named models', () => {
    expect(parseCast(eight())).toHaveLength(8);
  });
  it('rejects the wrong size, duplicates and bad entries', () => {
    expect(() => parseCast(eight().slice(0, 7))).toThrow('8 entries');
    expect(() => parseCast([...eight().slice(0, 7), { name: 'P0', model: 'x' }])).toThrow('unique');
    expect(() => parseCast([...eight().slice(0, 7), { name: 'P7' }])).toThrow('entry 7');
  });
  it('rejects the placeholder example file until real IDs are filled in', () => {
    const example = JSON.parse(readFileSync('config/cast.example.json', 'utf8')) as unknown;
    expect(Array.isArray(example) && example.length).toBe(8);
    expect(() => parseCast(example)).toThrow('openrouter.ai/models');
  });
});
