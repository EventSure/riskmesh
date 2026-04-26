import { describe, expect, it } from 'vitest';
import { buildCollateralStatus, collateralDeficit, maxPayoutTier } from '../collateral';

describe('collateral utilities', () => {
  it('selects the max payout tier', () => {
    expect(maxPayoutTier({
      delay2h: 5,
      delay3h: 8,
      delay4to5h: 12,
      delay6hOrCancelled: 15,
    })).toBe(15);
  });

  it('saturates deficit at zero', () => {
    expect(collateralDeficit(100, 40)).toBe(60);
    expect(collateralDeficit(100, 120)).toBe(0);
  });

  it('builds total and party collateral status', () => {
    const status = buildCollateralStatus({
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      collateralClaimCount: 10,
      reinsurerEffectiveBps: 4500,
      leaderShareBps: 5000,
      participants: [
        { id: 'p1', label: 'Participant A', shareBps: 3000, confirmed: true, balance: 20 },
        { id: 'p2', label: 'Participant B', shareBps: 2000, confirmed: false, balance: 20 },
      ],
      leader: { label: 'Leader', confirmed: true, balance: 50 },
      reinsurer: { label: 'Reinsurer', confirmed: true, balance: 70 },
    });

    expect(status.totalRequired).toBe(150);
    expect(status.totalFunded).toBe(160);
    expect(status.parties.find(p => p.id === 'leader')?.required).toBe(41.25);
    expect(status.parties.find(p => p.id === 'p1')?.required).toBe(24.75);
    expect(status.parties.find(p => p.id === 'p2')?.required).toBe(16.5);
    expect(status.parties.find(p => p.id === 'reinsurer')?.required).toBe(67.5);
    expect(status.parties.find(p => p.id === 'p1')?.state).toBe('underfunded');
    expect(status.parties.find(p => p.id === 'p2')?.state).toBe('pending_confirm');
    expect(status.aggregateReady).toBe(false);
  });

  it('assigns insurer remainder to the first positive share in micro-usdc units', () => {
    const status = buildCollateralStatus({
      payoutTiers: {
        delay2h: 0.000001,
        delay3h: 0.000001,
        delay4to5h: 0.000001,
        delay6hOrCancelled: 0.000001,
      },
      collateralClaimCount: 3,
      reinsurerEffectiveBps: 0,
      leaderShareBps: 5000,
      participants: [
        { id: 'p1', label: 'Participant A', shareBps: 5000, confirmed: true, balance: 0.000001 },
      ],
      leader: { label: 'Leader', confirmed: true, balance: 0.000002 },
    });

    expect(status.totalRequired).toBe(0.000003);
    expect(status.parties.find(p => p.id === 'leader')?.required).toBe(0.000002);
    expect(status.parties.find(p => p.id === 'p1')?.required).toBe(0.000001);
  });

  it('does not create a phantom deficit at the micro-usdc boundary', () => {
    const required = 2.0100000000000002;

    expect(collateralDeficit(required, 2.01)).toBe(0);

    const status = buildCollateralStatus({
      payoutTiers: {
        delay2h: required,
        delay3h: 1.5,
        delay4to5h: 1,
        delay6hOrCancelled: 1,
      },
      collateralClaimCount: 1,
      reinsurerEffectiveBps: 0,
      leaderShareBps: 10000,
      participants: [],
      leader: { label: 'Leader', confirmed: true, balance: 2.01 },
    });

    const leader = status.parties.find(p => p.id === 'leader');
    expect(leader?.required).toBe(2.01);
    expect(leader?.deficit).toBe(0);
    expect(leader?.state).toBe('ready');
    expect(status.aggregateReady).toBe(true);
  });

  it('rejects a collateral claim count below the supported range', () => {
    expect(() => buildCollateralStatus({
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      collateralClaimCount: 0,
      reinsurerEffectiveBps: 0,
      leaderShareBps: 10000,
      participants: [],
      leader: { label: 'Leader', confirmed: true, balance: 15 },
    })).toThrowError('collateralClaimCount must be an integer between 1 and 100');
  });

  it('rejects insurer share inputs that do not sum to 10000 bps', () => {
    expect(() => buildCollateralStatus({
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      collateralClaimCount: 1,
      reinsurerEffectiveBps: 0,
      leaderShareBps: 7000,
      participants: [
        { id: 'p1', label: 'Participant A', shareBps: 2000, confirmed: true, balance: 3 },
      ],
      leader: { label: 'Leader', confirmed: true, balance: 12 },
    })).toThrowError('insurer share bps must sum to 10000');
  });
});
