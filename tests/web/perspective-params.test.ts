import { describe, expect, it } from 'vitest';
import { perspectiveFromSearch, searchWithPerspective, searchWithSeat, seatFromSearch, splitSeatsFromSearch } from '../../web/src/perspective/params.js';

const cast = [{ name: 'Aria' }, { name: 'Bram' }, { name: 'Cleo' }];

describe('seatFromSearch', () => {
  it('reads a seat that is at the table and ignores one that is not', () => {
    expect(seatFromSearch('?log=x&seat=Bram', cast)).toBe('Bram');
    expect(seatFromSearch('?seat=Nobody', cast)).toBeNull();
    expect(seatFromSearch('?log=x', cast)).toBeNull();
    expect(seatFromSearch('?seat=bram', cast)).toBeNull();
  });
});

describe('searchWithSeat', () => {
  it('sets, replaces and removes the seat and keeps the other parameters', () => {
    expect(searchWithSeat('?log=x', 'Cleo')).toBe('?log=x&seat=Cleo');
    expect(searchWithSeat('?log=x&seat=Aria', 'Cleo')).toBe('?log=x&seat=Cleo');
    expect(searchWithSeat('?log=x&seat=Aria', null)).toBe('?log=x');
    expect(searchWithSeat('?seat=Aria', null)).toBe('');
    expect(searchWithSeat('', 'A b')).toBe('?seat=A+b');
  });
});

describe('splitSeatsFromSearch', () => {
  it('needs two different seats that are both at the table', () => {
    expect(splitSeatsFromSearch('?seats=Aria,Cleo', cast)).toEqual(['Aria', 'Cleo']);
    for (const bad of ['?seats=Aria', '?seats=Aria,Aria', '?seats=Aria,Zed', '?seats=Aria,Bram,Cleo', '?seats=', '']) {
      expect(splitSeatsFromSearch(bad, cast), bad).toBeNull();
    }
  });
});

describe('perspective in the URL', () => {
  it('reads the table, the spectator view or a seat, with a seat winning', () => {
    expect(perspectiveFromSearch('?log=x', cast)).toEqual({ kind: 'table' });
    expect(perspectiveFromSearch('?log=x&view=spectator', cast)).toEqual({ kind: 'spectator' });
    expect(perspectiveFromSearch('?view=spectator&seat=Bram', cast)).toEqual({ kind: 'seat', name: 'Bram' });
    expect(perspectiveFromSearch('?view=spectator&seat=Nobody', cast)).toEqual({ kind: 'spectator' });
    expect(perspectiveFromSearch('?view=other', cast)).toEqual({ kind: 'table' });
  });
  it('writes one perspective and keeps the other parameters', () => {
    expect(searchWithPerspective('?log=x&seat=Aria', { kind: 'spectator' })).toBe('?log=x&view=spectator');
    expect(searchWithPerspective('?log=x&view=spectator', { kind: 'seat', name: 'Cleo' })).toBe('?log=x&seat=Cleo');
    expect(searchWithPerspective('?log=x&seat=Aria', { kind: 'table' })).toBe('?log=x');
    expect(searchWithPerspective('?view=spectator', { kind: 'table' })).toBe('');
  });
});
