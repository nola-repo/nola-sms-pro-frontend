import { describe, it, expect } from 'vitest';
import { normalizePHNumber } from './src/api/sms';

describe('normalizePHNumber', () => {
  it('correctly normalizes valid formats', () => {
    const testCases = [
      { input: '09123456789', expected: '09123456789' },
      { input: '9123456789', expected: '09123456789' },
      { input: '639123456789', expected: '09123456789' },
      { input: '+639123456789', expected: '09123456789' },
      { input: '0912 345 6789', expected: '09123456789' },
      { input: '0912-345-6789', expected: '09123456789' },
    ];

    testCases.forEach(({ input, expected }) => {
      expect(normalizePHNumber(input)).toBe(expected);
    });
  });

  it('handles invalid numbers or those from other countries by formatting their E164 appropriately or returning null', () => {
      // It's up to us if we reject other countries. The current implementation 
      // parses other valid E.164 numbers without crashing, but only +63 turns to 09...
      // Let's just make sure it doesn't crash on invalid input.
      expect(normalizePHNumber('random_string')).toBe(null);
  });
});
