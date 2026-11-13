import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameLog } from '../../src/engine/types.js';
import type { GhostSeat, ServerMessage, SpectatorLog } from '../../server/protocol.js';
import type { Room } from '../../server/room.js';
import { startServer, type RunningServer } from '../../server/server.js';
import { TestClient } from './client.js';
import { waitFor } from './helpers.js';

const NAMES = ['Quinn', 'Rae', 'Sam', 'Tia'];

type Spectate = Extract<ServerMessage, { t: 'spectate' }>;
type Ghost = Extract<ServerMessage, { t: 'ghost' }>;
const maxRound = (log: SpectatorLog | null): number => Math.max(0, ...(log?.turns.map((t) => t.round) ?? [0]));

describe('ghosts and spectators over a real server', { timeout: 60_000 }, () => {
  let server: RunningServer;
  const clients: TestClient[] = [];
  beforeEach(async () => {
    server = await startServer({ port: 0, log: () => undefined, allowSeed: true, turnMs: 400 });
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await server.close();
  });

  const connect = async (): Promise<TestClient> => {
    const c = await TestClient.connect(server.port);
    clients.push(c);
    return c;
  };

  /** Four people (autoplaying) and four mock AIs play a whole game, with watchers; every spectate message is checked at the moment it is made. */
  async function play(seed: number, options: { ghosts?: boolean; spectators?: boolean; aliases?: boolean }) {
    const byName = new Map<string, TestClient>();
    for (const name of NAMES) {
      const c = await connect();
      c.autoplay(name);
      byName.set(name, c);
    }
    const host = byName.get('Quinn')!;
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed, ...(options.ghosts ? { ghosts: true } : {}), ...(options.spectators ? { spectators: true } : {}), ...(options.aliases ? { aliases: true } : {}) });
    const joined = await host.next('joined');
    const room = server.registry.get(joined.code)!;
    // At the moment each spectate message is made, note the round being played: the message may not reach it.
    const made: { live: number; max: number; complete: boolean }[] = [];
    const original = room.spectateMessage.bind(room);
    room.spectateMessage = (finished) => {
      const m = original(finished);
      if (m.t === 'spectate') made.push({ live: room.watching?.liveRound ?? 0, max: maxRound(m.log), complete: m.complete });
      return m;
    };
    for (const name of NAMES.slice(1)) byName.get(name)!.send({ t: 'join', code: joined.code, name });
    for (const name of NAMES.slice(1)) await byName.get(name)!.next('joined');
    const watchers: TestClient[] = [];
    if (options.spectators) {
      for (let i = 0; i < 2; i++) {
        const w = await connect();
        w.send({ t: 'watch', code: joined.code, token: joined.watch });
        await w.next('spectate');
        watchers.push(w);
      }
    }
    host.send({ t: 'start' });
    if (options.aliases) {
      // After an alias game each person guesses which seats were AIs before anyone learns who was who.
      for (const c of byName.values()) {
        await c.next('guess');
        c.send({ t: 'guess', ai: [] });
      }
    }
    const done = await host.next('finished');
    for (const c of byName.values()) await c.next('finished');
    if (options.spectators) for (const w of watchers) await waitFor(() => w.messages.some((m) => m.t === 'spectate' && m.complete), 5000);
    return { byName, host, joined, room, made, watchers, log: done.log as GameLog };
  }

  const beforeGhost = (messages: ServerMessage[]): ServerMessage[] => {
    const at = messages.findIndex((m) => m.t === 'ghost');
    const end = messages.findIndex((m) => m.t === 'finished');
    const cut = [at, end].filter((i) => i !== -1);
    return cut.length ? messages.slice(0, Math.min(...cut)) : messages;
  };
  const textOf = (messages: ServerMessage[]): string => messages.map((m) => (m.t === 'turn' ? `${JSON.stringify(m)}\n${m.user}` : JSON.stringify(m))).join('\n');

  it('with both options on: a living player gets nothing hidden, a ghost nothing before their exit, a spectator nothing newer than a round behind', async () => {
    const seen = { ghosts: 0, spectates: 0 };
    for (const seed of [4, 6, 11]) {
      const { byName, joined, made, watchers, log } = await play(seed, { ghosts: true, spectators: true });
      const cast = new Set(log.cast.map((c) => c.name));

      for (const name of NAMES) {
        const msgs = byName.get(name)!.messages;
        const label = `${name} (seed ${seed})`;
        // While they are playing, a person is sent only what a player is sent, whatever the room's options.
        const playing = beforeGhost(msgs);
        for (const m of playing) {
          expect(['joined', 'lobby', 'status', 'turn', 'turn_over', 'alias'], `${label} got a ${m.t}`).toContain(m.t);
          // The lobby only ever says who is seated, the mode, and which options the host chose.
          if (m.t === 'lobby') expect(Object.keys(m).sort(), label).toEqual(['aiSeats', 'aliases', 'code', 'ghosts', 'maxHumans', 'mode', 'seats', 'spectators', 't']);
        }
        // (The host's own `joined` carries the watch token: that is who it is for.)
        const text = textOf(playing.filter((m) => m.t !== 'joined'));
        for (const other of cast) if (other !== name) expect(text, `${label} sees ${other}'s role`).not.toContain(`You are ${other}. Your role:`);
        expect(text, label).not.toContain('MOCKNOTE-');
        expect(text, label).not.toContain(joined.watch!); // the watch token goes to the host alone
        if (name !== 'Quinn') expect(JSON.stringify(msgs), label).not.toContain(joined.watch!);

        // A ghost: the first ghost message comes after their last turn, every one shows them out, and no seat shows anything the log does not hold.
        const ghosts = msgs.filter((m): m is Ghost => m.t === 'ghost');
        const exited = log.events.some((e) => (e.type === 'breakfast' && e.victim === name) || (e.type === 'banishment' && e.player === name));
        if (!exited) expect(ghosts, `${label} never left the game`).toEqual([]);
        else {
          seen.ghosts++;
          expect(ghosts.length, label).toBeGreaterThan(0);
          const first = msgs.findIndex((m) => m.t === 'ghost');
          expect(msgs.slice(first).some((m) => m.t === 'turn'), `${label} was asked for a turn after becoming a ghost`).toBe(false);
          for (const g of ghosts) {
            expect(g.you).toBe(name);
            expect(g.seats.find((s: GhostSeat) => s.name === name)!.status).not.toBe('alive');
          }
        }
      }

      // Spectators: each message was made at least one round behind the live game, is a prefix of the real log, and the whole game comes last.
      for (const m of made.filter((x) => !x.complete)) expect(m.max, `a spectate message reached round ${m.max} while round ${m.live} was being played`).toBeLessThanOrEqual(Math.max(0, m.live - 1));
      for (const w of watchers) {
        const specs = w.messages.filter((m): m is Spectate => m.t === 'spectate');
        seen.spectates += specs.length;
        expect(specs.at(-1)!.complete).toBe(true);
        expect(specs.at(-1)!.log).toEqual(log);
        for (const m of specs.slice(0, -1)) {
          expect(m.complete).toBe(false);
          expect(m.log?.result ?? null).toBeNull();
          if (m.log) expect(m.log.turns).toEqual(log.turns.filter((t) => t.round <= maxRound(m.log)));
          expect(maxRound(m.log)).toBeLessThan(log.result.rounds);
        }
        expect(w.messages.every((m) => m.t === 'spectate'), 'a watcher is sent only the game, never a turn or a status').toBe(true);
        // Not the seed (it decides every role), and no roles before a full round is over.
        for (const m of specs.slice(0, -1)) {
          if (!m.log) continue;
          expect(m.log.seed).toBe(0);
          if (maxRound(m.log) < 1) expect(m.log.roles).toEqual({});
        }
        expect(specs.at(-1)!.log!.seed).toBe(log.seed);
      }
    }
    expect(seen.ghosts).toBeGreaterThan(0);
    expect(seen.spectates).toBeGreaterThan(2);
  });

  it('with the options off: no ghost, no spectate, and the watch link does not work even with a token', async () => {
    const { byName, joined, room } = await play(4, {});
    expect(joined.watch).toBeUndefined();
    for (const c of byName.values()) expect(c.messages.some((m) => m.t === 'ghost' || m.t === 'spectate')).toBe(false);
    const w = await connect();
    w.send({ t: 'watch', code: joined.code, token: '3f2c9a1e-8b4d-4c7a-9e1f-0a2b3c4d5e6f' });
    expect((await w.next('error')).message).toBe('That watch link does not work.');
    expect(room.spectators).toBe(false);
  });

  it('refuses a wrong token and an unknown room the same way, and a watcher can do nothing but watch', async () => {
    const { joined } = await play(4, { spectators: true });
    const bad = await connect();
    bad.send({ t: 'watch', code: joined.code, token: joined.watch!.replace(/.$/, joined.watch!.endsWith('0') ? '1' : '0') });
    const none = await connect();
    none.send({ t: 'watch', code: 'ZZZZ9', token: joined.watch });
    const e1 = await bad.next('error');
    const e2 = await none.next('error');
    expect(e1.message).toBe(e2.message);
    expect(bad.messages.some((m) => m.t === 'spectate')).toBe(false);

    const w = await connect();
    w.send({ t: 'watch', code: joined.code, token: joined.watch });
    await w.next('spectate');
    const before = w.messages.length;
    w.send({ t: 'answer', turn: 1, answer: { speech: '', note: '', choice: 'x', message: '' } });
    w.send({ t: 'create', name: 'Mallory', mode: 'mock' });
    w.send({ t: 'join', code: joined.code, name: 'Mallory' });
    w.send({ t: 'start' });
    w.send({ t: 'guess', ai: [] });
    await waitFor(() => w.messages.filter((m) => m.t === 'error').length >= 5, 5000);
    expect(w.messages.slice(before).every((m) => m.t === 'error')).toBe(true);
  });

  it('a spectator who connects mid-game or reconnects is shown the game as it stands, never a newer round than the live one allows', async () => {
    const host = await connect();
    host.autoplay('Quinn');
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 6, spectators: true });
    const joined = await host.next('joined');
    const room = server.registry.get(joined.code)!;
    const sent: { live: number; max: number }[] = [];
    const original = room.spectateMessage.bind(room);
    room.spectateMessage = (f) => {
      const m = original(f);
      if (m.t === 'spectate' && !m.complete) sent.push({ live: room.watching?.liveRound ?? 0, max: maxRound(m.log) });
      return m;
    };
    const early = await connect();
    early.send({ t: 'watch', code: joined.code, token: joined.watch });
    const lobby = await early.next('spectate');
    expect(lobby.log).toBeNull(); // nothing before the game starts
    host.send({ t: 'start' });
    await waitFor(() => room.watching !== null && room.watching.liveRound >= 2, 5000);
    for (let i = 0; i < 3; i++) {
      const w = await connect();
      w.send({ t: 'watch', code: joined.code, token: joined.watch });
      await w.next('spectate');
      w.close();
      await w.closed();
    }
    await host.next('finished');
    for (const s of sent) expect(s.max).toBeLessThanOrEqual(Math.max(0, s.live - 1));
    expect(sent.length).toBeGreaterThan(2);
    expect(room.watcherCount).toBeLessThanOrEqual(1); // the closed ones were removed
  });

  it('a person who left while playing and came back after they were out is a ghost from then on, and was told nothing while away', async () => {
    const people: TestClient[] = [];
    const host = await connect();
    host.autoplay('Quinn');
    host.send({ t: 'create', name: 'Quinn', mode: 'mock', seed: 7, ghosts: true });
    const joined = await host.next('joined');
    const room: Room = server.registry.get(joined.code)!;
    const tokens = new Map<string, string>();
    for (const name of NAMES.slice(1)) {
      const c = await connect();
      c.send({ t: 'join', code: joined.code, name });
      tokens.set(name, (await c.next('joined')).token);
      people.push(c);
    }
    // The three friends never answer: their turns time out, so the game takes a while and they leave the table by the game's own rules.
    for (const c of people) c.close();
    host.send({ t: 'start' });
    await waitFor(() => NAMES.slice(1).some((n) => room.outPeople.has(n)), 20_000);
    const gone = NAMES.slice(1).find((n) => room.outPeople.has(n))!;
    expect(room.phase).toBe('playing');
    const back = await connect();
    back.send({ t: 'rejoin', code: joined.code, token: tokens.get(gone)! });
    const ghost = await back.next('ghost');
    expect(ghost.you).toBe(gone);
    expect(ghost.seats.find((s) => s.name === gone)!.status).not.toBe('alive');
    // Before the ghost message they were only told what a returning player is: who they are, the lobby, the phase.
    const idx = back.messages.findIndex((m) => m.t === 'ghost');
    for (const m of back.messages.slice(0, idx)) expect(['joined', 'lobby', 'status', 'alias'], m.t).toContain(m.t);
    expect(textOf(back.messages.slice(0, idx))).not.toContain('Your role:');
    // And a person who is still in the game, rejoining, gets no ghost view.
    const stillIn = NAMES.slice(1).find((n) => !room.outPeople.has(n));
    if (stillIn && room.phase === 'playing') {
      const other = await connect();
      other.send({ t: 'rejoin', code: joined.code, token: tokens.get(stillIn)! });
      await other.next('joined');
      expect(other.messages.some((m) => m.t === 'ghost') || room.outPeople.has(stillIn)).toBe(room.outPeople.has(stillIn));
    }
    await host.next('finished');
  });

  it('in an alias room, ghosts and spectators see aliases only, and the models stay blank until the game is over', async () => {
    const { byName, watchers, log } = await play(4, { ghosts: true, spectators: true, aliases: true });
    expect(log.cast.map((c) => c.name).sort()).not.toEqual([...NAMES].sort());
    for (const w of watchers) {
      const specs = w.messages.filter((m): m is Spectate => m.t === 'spectate');
      for (const m of specs.filter((s) => !s.complete && s.log)) {
        expect(m.log!.cast.every((c) => c.model === '')).toBe(true);
        expect(m.log!.seed, 'the seed would give away who is human').toBe(0);
        for (const t of m.log!.turns) {
          expect(t.attempts).toHaveLength(1);
          expect(t.attempts[0]).toMatchObject({ raw: '', error: null });
          expect(t.fallback).toBe(false);
        }
        for (const name of NAMES) expect(JSON.stringify(m.log), `a spectator is shown the real name ${name}`).not.toContain(`"${name}"`);
      }
    }
    for (const [name, c] of byName) {
      for (const g of c.messages.filter((m): m is Ghost => m.t === 'ghost')) {
        for (const other of NAMES) if (other !== name) expect(JSON.stringify(g), `${name}'s ghost view names ${other}`).not.toContain(other);
      }
    }
  });
});
