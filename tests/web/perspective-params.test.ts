import { describe, expect, it } from 'vitest';
import { searchWithSeat, seatFromSearch, splitSeatsFromSearch } from '../../web/src/perspective/params.js';

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
