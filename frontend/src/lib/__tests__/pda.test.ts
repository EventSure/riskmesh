// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import {
  getMasterPolicyPDA,
  getFlightPolicyPDA,
  getPolicyPDA,
  getUnderwritingPDA,
  getRiskPoolPDA,
  getClaimPDA,
  getRegistryPDA,
} from '../pda';

// Use the actual deployed program ID (known to work with PDA derivation)
const TEST_PROGRAM_ID = new PublicKey('3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL');

// Use deterministic keypairs from fixed seeds for reproducible tests
const LEADER = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey;
const LEADER2 = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey;
const POLICY = Keypair.fromSeed(new Uint8Array(32).fill(3)).publicKey;
const POLICY2 = Keypair.fromSeed(new Uint8Array(32).fill(4)).publicKey;

describe('PDA derivation functions', () => {
  describe('getMasterPolicyPDA', () => {
    it('returns deterministic result for same inputs', () => {
      const [pda1, bump1] = getMasterPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      const [pda2, bump2] = getMasterPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
      expect(bump1).toBe(bump2);
    });

    it('returns different PDA for different master IDs', () => {
      const [pda1] = getMasterPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      const [pda2] = getMasterPolicyPDA(LEADER, new BN(2), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });

    it('returns different PDA for different leaders', () => {
      const [pda1] = getMasterPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      const [pda2] = getMasterPolicyPDA(LEADER2, new BN(1), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });

    it('bump is within valid range', () => {
      const [, bump] = getMasterPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });
  });

  describe('getFlightPolicyPDA', () => {
    it('returns deterministic result', () => {
      const [pda1] = getFlightPolicyPDA(POLICY, new BN(1), TEST_PROGRAM_ID);
      const [pda2] = getFlightPolicyPDA(POLICY, new BN(1), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });

    it('returns different PDA for different child policy IDs', () => {
      const [pda1] = getFlightPolicyPDA(POLICY, new BN(1), TEST_PROGRAM_ID);
      const [pda2] = getFlightPolicyPDA(POLICY, new BN(2), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });
  });

  describe('getPolicyPDA', () => {
    it('returns deterministic result', () => {
      const [pda1] = getPolicyPDA(LEADER, new BN(10), TEST_PROGRAM_ID);
      const [pda2] = getPolicyPDA(LEADER, new BN(10), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });

    it('uses different seed from getMasterPolicyPDA', () => {
      const [masterPda] = getMasterPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      const [policyPda] = getPolicyPDA(LEADER, new BN(1), TEST_PROGRAM_ID);
      expect(masterPda.equals(policyPda)).toBe(false);
    });
  });

  describe('getUnderwritingPDA', () => {
    it('returns deterministic result', () => {
      const [pda1] = getUnderwritingPDA(POLICY, TEST_PROGRAM_ID);
      const [pda2] = getUnderwritingPDA(POLICY, TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });

    it('different policy yields different PDA', () => {
      const [pda1] = getUnderwritingPDA(POLICY, TEST_PROGRAM_ID);
      const [pda2] = getUnderwritingPDA(POLICY2, TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });
  });

  describe('getRiskPoolPDA', () => {
    it('returns deterministic result', () => {
      const [pda1] = getRiskPoolPDA(POLICY, TEST_PROGRAM_ID);
      const [pda2] = getRiskPoolPDA(POLICY, TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });

    it('differs from underwriting PDA for same policy', () => {
      const [poolPda] = getRiskPoolPDA(POLICY, TEST_PROGRAM_ID);
      const [uwPda] = getUnderwritingPDA(POLICY, TEST_PROGRAM_ID);
      expect(poolPda.equals(uwPda)).toBe(false);
    });
  });

  describe('getClaimPDA', () => {
    it('returns deterministic result', () => {
      const [pda1] = getClaimPDA(POLICY, new BN(42), TEST_PROGRAM_ID);
      const [pda2] = getClaimPDA(POLICY, new BN(42), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });

    it('different oracle rounds yield different PDAs', () => {
      const [pda1] = getClaimPDA(POLICY, new BN(1), TEST_PROGRAM_ID);
      const [pda2] = getClaimPDA(POLICY, new BN(2), TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(false);
    });
  });

  describe('getRegistryPDA', () => {
    it('returns deterministic result', () => {
      const [pda1] = getRegistryPDA(POLICY, TEST_PROGRAM_ID);
      const [pda2] = getRegistryPDA(POLICY, TEST_PROGRAM_ID);
      expect(pda1.equals(pda2)).toBe(true);
    });

    it('differs from other PDAs for same policy', () => {
      const [regPda] = getRegistryPDA(POLICY, TEST_PROGRAM_ID);
      const [poolPda] = getRiskPoolPDA(POLICY, TEST_PROGRAM_ID);
      const [uwPda] = getUnderwritingPDA(POLICY, TEST_PROGRAM_ID);
      expect(regPda.equals(poolPda)).toBe(false);
      expect(regPda.equals(uwPda)).toBe(false);
    });
  });
});
