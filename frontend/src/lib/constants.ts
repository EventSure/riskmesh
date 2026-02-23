import { PublicKey } from '@solana/web3.js';

export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// TODO: Replace with actual program ID after `anchor keys list`
export const PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

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

export const UNDERWRITING_STATUSES = ['Proposed', 'Open', 'Finalized', 'Failed'] as const;

export const CLAIM_STATUSES = [
  'None',
  'PendingOracle',
  'Claimable',
  'Approved',
  'Settled',
  'Rejected',
] as const;
