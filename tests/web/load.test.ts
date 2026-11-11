import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadFromName, logNameFromSearch } from '../../web/src/load.js';

const fixture = readFileSync('tests/fixtures/sample-game.json', 'utf8');
const respond = (res: Response | Error): typeof fetch => (async () => { if (res instanceof Error) throw res; return res; }) as unknown as typeof fetch;

describe('logNameFromSearch', () => {
  it('accepts plain names and rejects anything that could leave the games folder', () => {
    expect(logNameFromSearch('?log=mock-seed-1')).toBe('mock-seed-1');
    expect(logNameFromSearch('?log=game_2026.05-01')).toBe('game_2026.05-01');
    for (const bad of ['?log=../x', '?log=a/b', '?log=a%2Fb', '?log=', '?log=..', '?other=1', '']) {
      expect(logNameFromSearch(bad), bad).toBeNull();
    }
  });
});

describe('loadFromName', () => {
  it('loads and parses a log', async () => {
    const r = await loadFromName('x', './', respond(new Response(fixture, { status: 200 })));
    expect(r.ok).toBe(true);
  });
  it('says what to do about a missing log', async () => {
    const r = await loadFromName('nope', './', respond(new Response('', { status: 404 })));
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('No log named "nope"') });
  });
  it('treats an HTML page with a 200 as a missing log (single-page-app hosting)', async () => {
    const page = new Response('<!doctype html><title>app</title>', { status: 200, headers: { 'content-type': 'text/html' } });
    expect(await loadFromName('nope', './', respond(page))).toMatchObject({ ok: false, message: expect.stringContaining('No log named "nope"') });
  });
  it('reports other HTTP errors, network failures and wrong schema versions', async () => {
    expect(await loadFromName('x', './', respond(new Response('', { status: 500 })))).toMatchObject({ ok: false, message: expect.stringContaining('HTTP 500') });
    expect(await loadFromName('x', './', respond(new Error('offline')))).toMatchObject({ ok: false, message: expect.stringContaining('Could not reach') });
    const v2 = JSON.stringify({ ...JSON.parse(fixture), schemaVersion: 2 });
    expect(await loadFromName('x', './', respond(new Response(v2, { status: 200 })))).toMatchObject({ ok: false, message: expect.stringContaining('schemaVersion 2') });
  });
});
