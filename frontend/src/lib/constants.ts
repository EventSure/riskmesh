import { PublicKey } from '@solana/web3.js';

export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

export const PROGRAM_ID = new PublicKey('3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL');

export const CURRENCY_MINT = new PublicKey('5YsAiRYU3tTFc5B8aaGwVL1oC9DVxBEddnXCaHcQQg2k');

export const POLICY_STATES = [
  'Draft',
  'Open',
  'Funded',
  'Active',
  'Claimable',
  'Approved',
  'Settled',
  'Expired',
] as const;

export type PolicyStateLabel = (typeof POLICY_STATES)[number];

export const MASTER_POLICY_STATES = [
  'Draft',
  'PendingConfirm',
  'Active',
  'Closed',
  'Cancelled',
] as const;

export const FLIGHT_POLICY_STATES = [
  'Issued',
  'AwaitingOracle',
  'Claimable',
  'Paid',
  'NoClaim',
  'Expired',
] as const;

export const UNDERWRITING_STATUSES = ['Proposed', 'Open', 'Finalized', 'Failed'] as const;

export const CLAIM_STATUSES = [
  'None',
  'PendingOracle',
  'Claimable',
  'Approved',
  'Settled',
  'Rejected',
] as const;

/** Default payout tiers in USDC (UI display units, not raw) */
export const DEFAULT_PAYOUT_TIERS = {
  delay2h: 5,
  delay3h: 8,
  delay4to5h: 12,
  delay6hOrCancelled: 15,
} as const;

/** Default premium per policy in token base units */
export const DEFAULT_PREMIUM = 1_000_000; // 1 USDC

/** Token decimals for display conversion */
export const TOKEN_DECIMALS = 6;

/** BPS denominator */
export const BPS_DENOM = 10_000;
