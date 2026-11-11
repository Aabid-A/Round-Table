import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEpisodeIndex } from '../../src/log/episodes.js';
import { findHighlights } from '../../src/log/highlights/index.js';
import { readSeason } from '../../src/log/season.js';
import { computeStats } from '../../src/log/stats.js';
import { renderTranscript } from '../../src/log/transcript.js';
import { readGameLog } from '../../src/log/writer.js';
import { roomLogName } from '../../src/roomCode.js';
import { buildSteps } from '../../web/src/replay/timeline.js';
import { runRoomGame } from '../../server/game.js';
import { saveLog } from '../../server/saveLog.js';
import { autoRoom } from './helpers.js';

/** Play a room game, save it the way the server does, and give back the folder, the name and the path. */
async function savedRoomGame(aliases: boolean) {
  const { room, seatPlayers } = autoRoom(['Quinn', 'Rae'], { mode: 'mock' }, 5);
  room.aliases = aliases;
  const log = await runRoomGame(room, { seatPlayers });
  const dir = await mkdtemp(join(tmpdir(), 'rt-room-compat-'));
  const name = roomLogName(room.code, room.seed);
  const path = await saveLog(dir, name, log);
  return { log, dir, name, path };
}

describe.each([false, true])('a saved room game (aliases: %s) works with the tools that read logs', (aliases) => {
  it('is read back by the command line\'s reader and found by the season reader', async () => {
    const { log, dir, name, path } = await savedRoomGame(aliases);
    expect(readGameLog(path)).toEqual(log);
    const season = readSeason(dir);
    expect(season.skipped).toEqual([]);
    expect(season.names).toEqual([name]);
  });

  it('feeds stats (a human row beside the mock row), highlights, the transcript, the episode index and the replay timeline', async () => {
    const { log, name, path } = await savedRoomGame(aliases);
    const read = readGameLog(path);
    const stats = computeStats([read]);
    expect(stats.games).toBe(1);
    expect(stats.models.map((m) => m.model).sort()).toEqual(['human', 'mock']);
    expect(Array.isArray(findHighlights(read, { name }))).toBe(true);
    expect(renderTranscript(read)).toContain(log.cast[0]!.name);
    const { index, skipped } = buildEpisodeIndex([{ name, log: read }]);
    expect(skipped).toEqual([]);
    expect(index.episodes).toHaveLength(1);
    expect(buildSteps(read).length).toBeGreaterThan(0);
  });
});
