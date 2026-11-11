import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isStatsPage, loadStatsFromName, statsNameFromSearch } from '../../web/src/stats/load.js';

const fixture = readFileSync('tests/fixtures/sample-stats.json', 'utf8');
const respond = (res: Response | Error): typeof fetch => (async () => { if (res instanceof Error) throw res; return res; }) as unknown as typeof fetch;

describe('page and name', () => {
  it('knows the stats page and reads a safe ?stats= name, defaulting to stats', () => {
    expect(isStatsPage('?page=stats')).toBe(true);
    expect(isStatsPage('?page=other')).toBe(false);
    expect(isStatsPage('')).toBe(false);
    expect(statsNameFromSearch('?page=stats')).toBe('stats');
    expect(statsNameFromSearch('?page=stats&stats=season-1')).toBe('season-1');
    for (const bad of ['../x', 'a/b', '..', '', 'a%2Fb']) expect(statsNameFromSearch(`?stats=${bad}`), bad).toBe('stats');
  });
});

describe('loadStatsFromName', () => {
  it('loads and parses the stats file', async () => {
    expect((await loadStatsFromName('stats', './', respond(new Response(fixture, { status: 200 })))).ok).toBe(true);
  });
  it('says how to create the file when it is missing, including when a host serves index.html with a 200', async () => {
    const gone = await loadStatsFromName('stats', './', respond(new Response('', { status: 404 })));
    expect(gone).toMatchObject({ ok: false, message: expect.stringContaining('No stats.json in web/public/. Create it with npm run stats') });
    const html = new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
    expect(await loadStatsFromName('stats', './', respond(html))).toMatchObject({ ok: false, message: expect.stringContaining('No stats.json') });
  });
  it('reports other HTTP errors, network failures and wrong versions', async () => {
    expect(await loadStatsFromName('stats', './', respond(new Response('', { status: 500 })))).toMatchObject({ message: expect.stringContaining('HTTP 500') });
    expect(await loadStatsFromName('stats', './', respond(new Error('offline')))).toMatchObject({ message: expect.stringContaining('Could not reach') });
    const v2 = JSON.stringify({ ...JSON.parse(fixture), statsVersion: 2 });
    expect(await loadStatsFromName('stats', './', respond(new Response(v2, { status: 200 })))).toMatchObject({ message: expect.stringContaining('statsVersion 2') });
  });
});
