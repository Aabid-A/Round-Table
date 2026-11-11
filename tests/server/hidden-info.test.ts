import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import type { ServerMessage } from '../../server/protocol.js';
import { startServer, type RunningServer } from '../../server/server.js';
import { TestClient } from './client.js';

const NAMES = ['Quinn', 'Rae', 'Sam', 'Tia'];

/** Everything a client was told before the game ended, as one string: each prompt, and each message as sent. */
function beforeTheEnd(messages: ServerMessage[]): { text: string; prompts: string[]; all: ServerMessage[] } {
  const end = messages.findIndex((m) => m.t === 'finished');
  const before = end === -1 ? messages : messages.slice(0, end);
  const prompts = before.flatMap((m) => (m.t === 'turn' ? [m.user] : []));
  return { text: [...before.map((m) => JSON.stringify(m)), ...prompts].join('\n'), prompts, all: before };
}

describe('no client learns hidden information before the end', () => {
  let server: RunningServer;
  const clients: TestClient[] = [];
  beforeEach(async () => {
    server = await startServer({ port: 0, log: () => undefined, allowSeed: true });
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await server.close();
  });

  /** Four people and four mock AIs play a whole game. */
  async function play(seed: number): Promise<{ log: GameLog; byName: Map<string, TestClient> }> {
    const byName = new Map<string, TestClient>();
    for (const name of NAMES) {
      const c = await TestClient.connect(server.port);
      clients.push(c);
      c.autoplay(name);
      byName.set(name, c);
    }
    const host = byName.get('Quinn')!;
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed });
    const { code } = await host.next('joined');
    for (const name of NAMES.slice(1)) byName.get(name)!.send({ t: 'join', code, name });
    for (const name of NAMES.slice(1)) await byName.get(name)!.next('joined');
    host.send({ t: 'start' });
    const done = await host.next('finished');
    for (const c of byName.values()) await c.next('finished');
    return { log: done.log, byName };
  }

  it('shows each person only their own role, notes and whispers, across games where they were traitors and faithfuls', async () => {
    const seen = { traitor: 0, faithful: 0 };
    for (const seed of [6, 7, 11]) {
      const { log, byName } = await play(seed);
      const cast = new Set(log.cast.map((c) => c.name));
      const recruitedTo = new Set(log.events.flatMap((e) => (e.type === 'recruit' && e.accepted ? [e.offeredTo] : [])));

      for (const name of NAMES) {
        const { text, prompts, all } = beforeTheEnd(byName.get(name)!.messages);
        const role = log.roles[name]!;
        const label = `${name} (${role}, seed ${seed})`;
        seen[role]++;

        // Their own role is shown; nobody else's is.
        // (Someone murdered on the first night has no turns, so there is no prompt to read.)
        if (prompts[0] !== undefined) expect(prompts[0], label).toContain(`You are ${name}. Your role: ${role}.`);
        for (const other of cast) if (other !== name) expect(text, `${label} sees ${other}'s role line`).not.toContain(`You are ${other}. Your role:`);

        // Traitor-only lines never reach someone who has not been a traitor.
        if (role === 'faithful' && !recruitedTo.has(name)) {
          for (const secret of ['Your fellow traitors', 'You are the only traitor left', 'Your pack', 'fellow traitors did not all pick']) expect(text, `${label} sees "${secret}"`).not.toContain(secret);
        }

        // Private notes stay private: no AI's note, and no other person's.
        expect(text, label).not.toContain('MOCKNOTE-');
        for (const other of NAMES) if (other !== name) expect(text, `${label} sees ${other}'s note`).not.toContain(`HUMANNOTE-${other}-`);

        // A whisper reaches only the two people in it.
        const allowed = new Set(log.events.flatMap((e) => (e.type === 'whisper' && e.visibleTo !== 'all' && e.visibleTo.includes(name) ? [e.message] : [])));
        for (const tag of text.match(/WHISPER-[A-Za-z]+-\d{4}/g) ?? []) expect([...allowed].some((m) => m.includes(tag)), `${label} sees whisper ${tag} meant for others`).toBe(true);

        // Nothing structural leaks: no roles table, raw replies or notes in what was sent before the end.
        for (const key of ['"roles"', '"private_notes"', '"raw"', '"systemPrompt"', '"attempts"']) expect(text, `${label} gets ${key}`).not.toContain(key);
        for (const m of all) if (m.t === 'status') expect(Object.keys(m).sort()).toEqual(['phase', 't']);
        for (const m of all) if (m.t === 'turn') for (const o of m.options) expect(cast.has(o) || ['accept', 'refuse', 'end', 'banish'].includes(o), `${label} option ${o}`).toBe(true);
      }
    }
    // The check only means something if it ran for both roles.
    expect(seen.traitor).toBeGreaterThan(0);
    expect(seen.faithful).toBeGreaterThan(0);
  });

  it('sends the log only after the game, and the log is the same for everyone', async () => {
    const { byName } = await play(6);
    const logs = NAMES.map((n) => JSON.stringify((byName.get(n)!.messages.find((m) => m.t === 'finished') as { log: GameLog }).log));
    expect(new Set(logs).size).toBe(1);
    for (const n of NAMES) {
      const msgs = byName.get(n)!.messages;
      expect(msgs.filter((m) => m.t === 'finished')).toHaveLength(1);
      expect(msgs.at(-1)!.t).toBe('finished');
    }
  });
});
