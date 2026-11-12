import { describe, expect, it } from 'vitest';
import { inviteLink, isRoomMode, replayLink, roomCodeFromSearch, roomSeedFromSearch, roomServerHost, roomServerUrl } from '../../web/src/rooms/params.js';

describe('isRoomMode and roomCodeFromSearch', () => {
  it('opens the rooms page for ?mode=room or a valid invite code', () => {
    expect(isRoomMode('?mode=room')).toBe(true);
    expect(isRoomMode('?room=ab2cd')).toBe(true);
    expect(isRoomMode('?room=nope')).toBe(false);
    expect(isRoomMode('?mode=play')).toBe(false);
    expect(isRoomMode('')).toBe(false);
  });
  it('reads the code in standard form, or nothing', () => {
    expect(roomCodeFromSearch('?mode=room&room=ab2cd')).toBe('AB2CD');
    expect(roomCodeFromSearch('?room=AB0CD')).toBeNull();
    expect(roomCodeFromSearch('?mode=room')).toBeNull();
  });
});

describe('roomServerUrl', () => {
  const http = { protocol: 'http:', hostname: 'localhost' };
  it('defaults to port 8787 on the page host, secure when the page is', () => {
    expect(roomServerUrl(undefined, http)).toBe('ws://localhost:8787');
    expect(roomServerUrl('', { protocol: 'https:', hostname: 'play.example.org' })).toBe('wss://play.example.org:8787');
  });
  it('uses a configured ws or wss address', () => {
    expect(roomServerUrl('ws://127.0.0.1:8788', http)).toBe('ws://127.0.0.1:8788');
    expect(roomServerUrl('wss://rooms.example.org/play', http)).toBe('wss://rooms.example.org/play');
  });
  it('ignores a configured address that is not a ws address', () => {
    for (const bad of ['http://x.example', 'javascript:alert(1)', 'ws://', 'rooms.example.org', 'ws://a b']) expect(roomServerUrl(bad, http), bad).toBe('ws://localhost:8787');
  });
});

describe('inviteLink', () => {
  it('opens the rooms page on the join form with the code', () => {
    expect(inviteLink({ origin: 'https://play.example.org', pathname: '/table/' }, 'AB2CD')).toBe('https://play.example.org/table/?mode=room&room=AB2CD');
  });
});

describe('roomSeedFromSearch', () => {
  it('reads a whole-number seed, and is undefined otherwise so the server picks', () => {
    expect(roomSeedFromSearch('?mode=room&seed=5')).toBe(5);
    expect(roomSeedFromSearch('?seed=0')).toBe(0);
    for (const bad of ['', '?seed=', '?seed=-1', '?seed=1.5', '?seed=abc', '?seed=1234567890']) expect(roomSeedFromSearch(bad), bad).toBeUndefined();
  });
});

describe('replayLink', () => {
  it('opens the replay page on the room\'s saved log', () => {
    expect(replayLink({ origin: 'https://play.example.org', pathname: '/table/' }, 'AB2CD', 42)).toBe('https://play.example.org/table/?log=room-AB2CD-seed-42');
  });
});

describe('roomServerHost', () => {
  it('is the host and port of the room server, to tell a host where their key goes', () => {
    expect(roomServerHost('ws://localhost:8788')).toBe('localhost:8788');
    expect(roomServerHost('wss://rooms.example.org')).toBe('rooms.example.org');
    expect(roomServerHost('wss://rooms.example.org:8443/play')).toBe('rooms.example.org:8443');
  });
  it('falls back to the address itself when it cannot be read', () => {
    expect(roomServerHost('not an address')).toBe('not an address');
  });
});
