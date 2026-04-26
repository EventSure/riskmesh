import { Keypair, PublicKey } from '@solana/web3.js';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { BN } from '@coral-xyz/anchor';
import type { CollateralStatus } from '@/lib/collateral';
import type { FlightPolicyAccount, MasterAgreementAccount } from '@/lib/idl/open_parametric';
import { resolveLeaderLabel, resolvePartyLabel } from '../usePoolCollateralStatus';
import type { FlightPolicyWithKey } from '../useFlightPolicies';
import { buildMasterAgreementSnapshot, useMasterAgreementSnapshot } from '../useMasterAgreementSnapshot';

const mockUseFlightPolicies = vi.fn();
const mockUseMasterAgreementAccount = vi.fn();
const mockUsePoolCollateralStatus = vi.fn();

vi.mock('../useFlightPolicies', () => ({
  useFlightPolicies: (...args: unknown[]) => mockUseFlightPolicies(...args),
}));

vi.mock('../useMasterAgreementAccount', () => ({
  useMasterAgreementAccount: (...args: unknown[]) => mockUseMasterAgreementAccount(...args),
}));

vi.mock('../usePoolCollateralStatus', async () => {
  const actual = await vi.importActual<typeof import('../usePoolCollateralStatus')>('../usePoolCollateralStatus');
  return {
    ...actual,
    usePoolCollateralStatus: (...args: unknown[]) => mockUsePoolCollateralStatus(...args),
  };
});

function fakeBn(value: number): BN {
  return {
    toNumber: () => value,
    toString: () => String(value),
  } as unknown as BN;
}

function makeMasterAgreement(): MasterAgreementAccount {
  return {
    masterId: fakeBn(1),
    name: 'Korea-US Flight Delay Facility',
    leader: PublicKey.default,
    operator: PublicKey.default,
    currencyMint: PublicKey.default,
    coverageStartTs: fakeBn(0),
    coverageEndTs: fakeBn(0),
    premiumPerPolicy: fakeBn(3_000_000),
    payoutDelay2H: fakeBn(5_000_000),
    payoutDelay3H: fakeBn(8_000_000),
    payoutDelay4To5H: fakeBn(12_000_000),
    payoutDelay6HOrCancelled: fakeBn(15_000_000),
    leaderShareBps: 5000,
    cededRatioBps: 5000,
    reinsCommissionBps: 1000,
    reinsurerEffectiveBps: 4500,
    reinsurer: null,
    reinsurerConfirmed: false,
    reinsurerPoolWallet: null,
    reinsurerDepositWallet: null,
    leaderPoolWallet: PublicKey.default,
    leaderDepositWallet: PublicKey.default,
    participants: [],
    oracleFeed: PublicKey.default,
    status: 1,
    createdAt: fakeBn(0),
    bump: 0,
    collateralClaimCount: 10,
  };
}

function makePolicy(id: number, premiumPaidRaw: number, payoutAmountRaw: number): FlightPolicyWithKey {
  return {
    publicKey: PublicKey.default,
    account: {
      childPolicyId: fakeBn(id),
      master: PublicKey.default,
      creator: PublicKey.default,
      subscriberRef: `SUB-${id}`,
      flightNo: 'KE081',
      route: 'ICN-JFK',
      departureTs: fakeBn(0),
      premiumPaid: fakeBn(premiumPaidRaw),
      delayMinutes: 0,
      cancelled: false,
      payoutAmount: fakeBn(payoutAmountRaw),
      status: 0,
      premiumDistributed: false,
      createdAt: fakeBn(0),
      updatedAt: fakeBn(0),
      bump: 0,
    } as FlightPolicyAccount,
  };
}

function makeCollateralStatus(): CollateralStatus {
  return {
    totalRequired: 15,
    totalFunded: 10,
    totalDeficit: 5,
    totalSurplus: 0,
    totalHealthPct: 66.7,
    aggregateReady: false,
    parties: [
      {
        id: 'leader',
        label: 'Leader',
        role: 'leader',
        shareBps: 5000,
        required: 10,
        balance: 5,
        deficit: 5,
        surplus: 0,
        fundedPct: 50,
        confirmed: true,
        state: 'underfunded',
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMasterAgreementAccount.mockReturnValue({
    account: makeMasterAgreement(),
    loading: false,
    error: null,
  });
  mockUsePoolCollateralStatus.mockReturnValue({
    status: makeCollateralStatus(),
    activePartyId: 'leader',
    masterData: makeMasterAgreement(),
  });
  mockUseFlightPolicies.mockReturnValue({
    policies: [],
    loading: false,
    error: null,
  });
});

describe('buildMasterAgreementSnapshot', () => {
  test('prefers selected agreement name for the leader-facing label path', () => {
    expect(resolveLeaderLabel('  Fresh Named Agreement  ', 'Chain Name', 'Leader')).toBe('Fresh Named Agreement');
    expect(resolveLeaderLabel('', 'Chain Name', 'Leader')).toBe('Chain Name');
    expect(resolveLeaderLabel(null, '   ', 'Leader')).toBe('Leader');
  });

  test('prefers wallet display names, then stored labels, then fallbacks for participants and reinsurers', () => {
    const wallet = Keypair.generate().publicKey;

    expect(
      resolvePartyLabel(wallet, 'Participant 1', { [wallet.toBase58()]: '  Hana Fire  ' }, 'Stored Participant'),
    ).toBe('Hana Fire');
    expect(resolvePartyLabel(wallet, 'Reinsurer', {}, '  Korean Re  ')).toBe('Korean Re');
    expect(resolvePartyLabel(null, 'Participant 2', {}, '   ')).toBe('Participant 2');
  });

  test('derives premium inflow, claim outflow, net balance, and blockers', () => {
    const snapshot = buildMasterAgreementSnapshot(
      makeMasterAgreement(),
      [makePolicy(1, 3_000_000, 0), makePolicy(2, 3_000_000, 8_000_000)],
      makeCollateralStatus(),
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot?.totalPremiumInflow).toBe(6);
    expect(snapshot?.totalClaimOutflow).toBe(8);
    expect(snapshot?.netBalance).toBe(-2);
    expect(snapshot?.blockers).toContain('leader');
  });

  test('exposes loading, error, and ready policy states separately from snapshot totals', () => {
    mockUseFlightPolicies.mockReturnValueOnce({
      policies: [],
      loading: true,
      error: null,
    });
    const loadingResult = renderHook(() => useMasterAgreementSnapshot(PublicKey.default));
    expect(loadingResult.result.current.policyStatus).toBe('loading');

    mockUseFlightPolicies.mockReturnValueOnce({
      policies: [],
      loading: false,
      error: 'policy fetch failed',
    });
    const errorResult = renderHook(() => useMasterAgreementSnapshot(PublicKey.default));
    expect(errorResult.result.current.policyStatus).toBe('error');

    const readyResult = renderHook(() => useMasterAgreementSnapshot(PublicKey.default));
    expect(readyResult.result.current.policyStatus).toBe('ready');
  });
});
