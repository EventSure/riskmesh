import { describe, it, expect } from 'vitest';
import { getTier, fakePubkey, formatNum, TIERS } from '../useProtocolStore';

describe('getTier', () => {
  it('returns null for delay below 120', () => {
    expect(getTier(0)).toBeNull();
    expect(getTier(60)).toBeNull();
    expect(getTier(119)).toBeNull();
  });

  it('returns delay2h tier for 120-179', () => {
    expect(getTier(120)).toEqual(TIERS[0]);
    expect(getTier(150)).toEqual(TIERS[0]);
    expect(getTier(179)).toEqual(TIERS[0]);
  });

  it('returns delay3h tier for 180-239', () => {
    expect(getTier(180)).toEqual(TIERS[1]);
    expect(getTier(200)).toEqual(TIERS[1]);
    expect(getTier(239)).toEqual(TIERS[1]);
  });

  it('returns delay4to5h tier for 240-359', () => {
    expect(getTier(240)).toEqual(TIERS[2]);
    expect(getTier(300)).toEqual(TIERS[2]);
    expect(getTier(359)).toEqual(TIERS[2]);
  });

  it('returns delay6hOrCancelled tier for 360+', () => {
    expect(getTier(360)).toEqual(TIERS[3]);
    expect(getTier(720)).toEqual(TIERS[3]);
    expect(getTier(9999)).toEqual(TIERS[3]);
  });

  it('returns null for values above 9999', () => {
    expect(getTier(10000)).toBeNull();
  });

  it('TIERS ranges are contiguous', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].min).toBe(TIERS[i - 1].max + 1);
    }
  });
});

describe('fakePubkey', () => {
  it('returns deterministic output for same input', () => {
    expect(fakePubkey('test')).toBe(fakePubkey('test'));
  });

  it('returns different output for different input', () => {
    expect(fakePubkey('a')).not.toBe(fakePubkey('b'));
  });

  it('returns string of length 44', () => {
    expect(fakePubkey('anything')).toHaveLength(44);
  });

  it('only contains base58 characters', () => {
    const base58 = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    expect(fakePubkey('test_seed')).toMatch(base58);
    expect(fakePubkey('')).toMatch(base58);
  });
});

describe('formatNum', () => {
  it('formats with default 2 decimal places', () => {
    expect(formatNum(1234.5)).toBe('1,234.50');
  });

  it('formats with custom decimal places', () => {
    expect(formatNum(1234.5678, 4)).toBe('1,234.5678');
  });

  it('formats zero', () => {
    expect(formatNum(0)).toBe('0.00');
  });

  it('formats large numbers with commas', () => {
    expect(formatNum(1000000)).toBe('1,000,000.00');
  });

  it('rounds correctly', () => {
    expect(formatNum(1.999, 2)).toBe('2.00');
  });

  it('formats with 0 decimal places', () => {
    expect(formatNum(1234.5, 0)).toBe('1,235');
  });
});
