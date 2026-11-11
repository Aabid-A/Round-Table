import { describe, expect, it } from 'vitest';
import { actionForKey } from '../../web/src/keys.js';

const body = { tagName: 'BODY' };
const input = (type: string) => ({ tagName: 'INPUT', type });

describe('actionForKey', () => {
  it('steps with the arrows and plays with space on the page', () => {
    expect(actionForKey('ArrowRight', body)).toBe('next');
    expect(actionForKey('ArrowLeft', body)).toBe('prev');
    expect(actionForKey(' ', body)).toBe('toggle');
    expect(actionForKey('a', body)).toBeNull();
  });

  it('keeps stepping with the arrows after the notes checkbox was clicked', () => {
    expect(actionForKey('ArrowRight', input('checkbox'))).toBe('next');
    expect(actionForKey('ArrowLeft', input('checkbox'))).toBe('prev');
  });

  it('leaves space to buttons and checkboxes, which it activates natively', () => {
    expect(actionForKey(' ', { tagName: 'BUTTON' })).toBeNull();
    expect(actionForKey(' ', input('checkbox'))).toBeNull();
    expect(actionForKey('ArrowRight', { tagName: 'BUTTON' })).toBe('next');
  });

  it('leaves the arrows to the scrubber but still plays with space', () => {
    expect(actionForKey('ArrowRight', input('range'))).toBeNull();
    expect(actionForKey('ArrowLeft', input('range'))).toBeNull();
    expect(actionForKey(' ', input('range'))).toBe('toggle');
  });

  it('does nothing while typing', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', ' ']) {
      expect(actionForKey(key, input('text'))).toBeNull();
      expect(actionForKey(key, { tagName: 'TEXTAREA' })).toBeNull();
      expect(actionForKey(key, { tagName: 'DIV', isContentEditable: true })).toBeNull();
    }
  });
});
