import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { PROGRAM_ID } from './constants';

/**
 * Derive PDA for MasterAgreement account.
 * Seeds: ["master_agreement", leader, master_id_le]
 */
export function getMasterAgreementPDA(
  leader: PublicKey,
  masterId: BN,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('master_agreement'),
      leader.toBuffer(),
      masterId.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );
}

/**
 * Derive PDA for FlightPolicy account.
 * Seeds: ["flight_policy", master_agreement, child_policy_id_le]
 */
export function getFlightPolicyPDA(
  masterAgreement: PublicKey,
  childPolicyId: BN,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('flight_policy'),
      masterAgreement.toBuffer(),
      childPolicyId.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );
}

/* ── Legacy Flow PDAs (for future use) ── */

export function getPolicyPDA(
  leader: PublicKey,
  policyId: BN,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('policy'),
      leader.toBuffer(),
      policyId.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );
}

export function getUnderwritingPDA(
  policy: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('underwriting'), policy.toBuffer()],
    programId,
  );
}

export function getRiskPoolPDA(
  policy: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), policy.toBuffer()],
    programId,
  );
}

export function getClaimPDA(
  policy: PublicKey,
  oracleRound: BN,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('claim'),
      policy.toBuffer(),
      oracleRound.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );
}

export function getRegistryPDA(
  policy: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('registry'), policy.toBuffer()],
    programId,
  );
}
