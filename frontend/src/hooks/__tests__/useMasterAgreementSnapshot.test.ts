import { PublicKey } from '@solana/web3.js';
import { describe, expect, test } from 'vitest';
import type { BN } from '@coral-xyz/anchor';
import type { CollateralStatus } from '@/lib/collateral';
import type { FlightPolicyAccount, MasterAgreementAccount } from '@/lib/idl/open_parametric';
import type { FlightPolicyWithKey } from '../useFlightPolicies';
import { buildMasterAgreementSnapshot } from '../useMasterAgreementSnapshot';

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

describe('buildMasterAgreementSnapshot', () => {
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
});
