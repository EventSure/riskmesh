import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useSettlementData } from '../useSettlementData';

const getState = () => useProtocolStore.getState();

beforeEach(() => {
  getState().resetAll();
  useProtocolStore.setState({
    role: 'leader',
    masterActive: true,
    shares: { leader: 50, partA: 30, partB: 20 },
    premiumPerPolicy: 3,
    cededRatioBps: 5000,
    reinsCommissionBps: 1000,
    payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
    poolBalance: 10000,
  });
});

describe('useSettlementData', () => {
  it('returns zeros when no claims exist', () => {
    const { result } = renderHook(() => useSettlementData());
    expect(result.current.settledTotalPremium).toBe(0);
    expect(result.current.settledTotalClaim).toBe(0);
    expect(result.current.settledCount).toBe(0);
    expect(result.current.pendingCount).toBe(0);
  });

  it('counts pending (claimable) claims correctly', () => {
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().addContract('B', 'OZ201', '2026-02-05');
    getState().runOracle(1, 120, 0, false);
    getState().runOracle(2, 180, 0, false);

    const { result } = renderHook(() => useSettlementData());
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.settledCount).toBe(0);
  });

  it('aggregates settled claims correctly', () => {
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().runOracle(1, 120, 0, false); // payout=5
    getState().approveClaims();
    getState().settleClaims();

    const { result } = renderHook(() => useSettlementData());
    expect(result.current.settledCount).toBe(1);
    expect(result.current.settledTotalClaim).toBeCloseTo(5, 6);
    // 1 settled contract × premiumPerPolicy(3)
    expect(result.current.settledTotalPremium).toBeCloseTo(3, 6);
  });

  it('only counts settled claims, not claimable or approved', () => {
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().addContract('B', 'OZ201', '2026-02-05');
    getState().addContract('C', 'KE085', '2026-03-10');
    getState().runOracle(1, 120, 0, false); // claimable
    getState().runOracle(2, 180, 0, false); // will be approved
    getState().runOracle(3, 240, 0, false); // will be settled

    // Approve all, then settle only those that are approved
    getState().approveClaims(); // all 3 → approved
    getState().settleClaims();  // all 3 → settled

    const { result } = renderHook(() => useSettlementData());
    expect(result.current.settledCount).toBe(3);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.settledTotalClaim).toBeCloseTo(5 + 8 + 12, 6);
  });

  it('calculates settled premium distribution correctly', () => {
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().runOracle(1, 120, 0, false);
    getState().approveClaims();
    getState().settleClaims();

    const { result } = renderHook(() => useSettlementData());
    const acc = result.current.settledAcc;

    // reinsEff = 0.5 * 0.9 = 0.45
    // settledTotalPremium = 3
    // leaderPrem = 3 * 0.5 * (1 - 0.45) = 3 * 0.5 * 0.55 = 0.825
    // partAPrem = 3 * 0.3 * 0.55 = 0.495
    // partBPrem = 3 * 0.2 * 0.55 = 0.33
    // reinPrem = 3 * 0.45 = 1.35
    expect(acc.leaderPrem).toBeCloseTo(0.825, 6);
    expect(acc.partAPrem).toBeCloseTo(0.495, 6);
    expect(acc.partBPrem).toBeCloseTo(0.33, 6);
    expect(acc.reinPrem).toBeCloseTo(1.35, 6);
  });

  it('calculates settled claim distribution from actual claims', () => {
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().runOracle(1, 120, 0, false); // payout=5
    getState().approveClaims();
    getState().settleClaims();

    const { result } = renderHook(() => useSettlementData());
    const acc = result.current.settledAcc;

    // claim lNet = 5 * 0.55 * 0.5 = 1.375
    // claim aNet = 5 * 0.55 * 0.3 = 0.825
    // claim bNet = 5 * 0.55 * 0.2 = 0.55
    // claim rNet = 5 * 0.45 = 2.25
    expect(acc.leaderClaim).toBeCloseTo(1.375, 6);
    expect(acc.partAClaim).toBeCloseTo(0.825, 6);
    expect(acc.partBClaim).toBeCloseTo(0.55, 6);
    expect(acc.reinClaim).toBeCloseTo(2.25, 6);
  });
});
