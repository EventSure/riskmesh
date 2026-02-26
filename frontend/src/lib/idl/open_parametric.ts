/**
 * TypeScript types mirroring the on-chain contract state.
 * These will be replaced by auto-generated types after `anchor build`.
 */
import { PublicKey } from '@solana/web3.js';
import type { BN } from '@coral-xyz/anchor';

/* ── Enums (numeric representation matching on-chain u8 values) ── */

export enum MasterPolicyStatus {
  Draft = 0,
  PendingConfirm = 1,
  Active = 2,
  Closed = 3,
  Cancelled = 4,
}

export enum FlightPolicyStatus {
  Issued = 0,
  AwaitingOracle = 1,
  Claimable = 2,
  Paid = 3,
  NoClaim = 4,
  Expired = 5,
}

export enum ConfirmRole {
  Participant = 0,
  Reinsurer = 1,
}

export enum PolicyState {
  Draft = 0,
  Open = 1,
  Funded = 2,
  Active = 3,
  Claimable = 4,
  Approved = 5,
  Settled = 6,
  Expired = 7,
}

/* ── On-chain Account Types ── */

export interface MasterParticipant {
  insurer: PublicKey;
  shareBps: number;
  confirmed: boolean;
  poolWallet: PublicKey;
  depositWallet: PublicKey;
}

export interface MasterPolicyAccount {
  masterId: BN;
  leader: PublicKey;
  operator: PublicKey;
  currencyMint: PublicKey;
  coverageStartTs: BN;
  coverageEndTs: BN;
  premiumPerPolicy: BN;
  payoutDelay2h: BN;
  payoutDelay3h: BN;
  payoutDelay4to5h: BN;
  payoutDelay6hOrCancelled: BN;
  cededRatioBps: number;
  reinsCommissionBps: number;
  reinsurerEffectiveBps: number;
  reinsurer: PublicKey;
  reinsurerConfirmed: boolean;
  reinsurerPoolWallet: PublicKey;
  reinsurerDepositWallet: PublicKey;
  leaderDepositWallet: PublicKey;
  participants: MasterParticipant[];
  status: number;
  createdAt: BN;
  bump: number;
}

export interface FlightPolicyAccount {
  childPolicyId: BN;
  master: PublicKey;
  creator: PublicKey;
  subscriberRef: string;
  flightNo: string;
  route: string;
  departureTs: BN;
  premiumPaid: BN;
  delayMinutes: number;
  cancelled: boolean;
  payoutAmount: BN;
  status: number;
  premiumDistributed: boolean;
  createdAt: BN;
  updatedAt: BN;
  bump: number;
}

/* ── Instruction Param Types ── */

export interface MasterParticipantInit {
  insurer: PublicKey;
  shareBps: number;
}

export interface CreateMasterPolicyParams {
  masterId: BN;
  coverageStartTs: BN;
  coverageEndTs: BN;
  premiumPerPolicy: BN;
  payoutDelay2h: BN;
  payoutDelay3h: BN;
  payoutDelay4to5h: BN;
  payoutDelay6hOrCancelled: BN;
  cededRatioBps: number;
  reinsCommissionBps: number;
  participants: MasterParticipantInit[];
}

export interface CreateFlightPolicyParams {
  childPolicyId: BN;
  subscriberRef: string;
  flightNo: string;
  route: string;
  departureTs: BN;
}

/* ── Status label helpers ── */

export const MASTER_STATUS_LABELS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: 'Draft',
  [MasterPolicyStatus.PendingConfirm]: 'PendingConfirm',
  [MasterPolicyStatus.Active]: 'Active',
  [MasterPolicyStatus.Closed]: 'Closed',
  [MasterPolicyStatus.Cancelled]: 'Cancelled',
};

export const FLIGHT_STATUS_LABELS: Record<number, string> = {
  [FlightPolicyStatus.Issued]: 'Issued',
  [FlightPolicyStatus.AwaitingOracle]: 'AwaitingOracle',
  [FlightPolicyStatus.Claimable]: 'Claimable',
  [FlightPolicyStatus.Paid]: 'Paid',
  [FlightPolicyStatus.NoClaim]: 'NoClaim',
  [FlightPolicyStatus.Expired]: 'Expired',
};
