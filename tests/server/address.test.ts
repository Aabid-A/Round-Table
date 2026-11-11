import { describe, expect, it } from 'vitest';
import { addressOf } from '../../server/address.js';

describe('addressOf', () => {
  it("uses the socket's address and ignores X-Forwarded-For unless the proxy is trusted", () => {
    expect(addressOf({ 'x-forwarded-for': '6.6.6.6' }, '10.0.0.1', false)).toBe('10.0.0.1');
    expect(addressOf({}, '10.0.0.1', false)).toBe('10.0.0.1');
    expect(addressOf({}, undefined, false)).toBeNull();
  });

  it("behind a trusted proxy uses the last entry, which the proxy added, so a client cannot choose its address by sending the header", () => {
    expect(addressOf({ 'x-forwarded-for': '203.0.113.9' }, '10.0.0.1', true)).toBe('203.0.113.9');
    // The client sent a made-up first entry; the proxy appended the real peer.
    expect(addressOf({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }, '10.0.0.1', true)).toBe('203.0.113.9');
    expect(addressOf({ 'x-forwarded-for': ['1.2.3.4', '203.0.113.9'] }, '10.0.0.1', true)).toBe('203.0.113.9');
  });

  it('falls back to the socket when trusted but the header is missing or empty', () => {
    expect(addressOf({}, '10.0.0.1', true)).toBe('10.0.0.1');
    expect(addressOf({ 'x-forwarded-for': '  ' }, '10.0.0.1', true)).toBe('10.0.0.1');
  });
});
