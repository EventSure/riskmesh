import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { resolveProgramConfig, withResolvedProgramAddress } from '../programEnv';

const STABLE_ID = 'ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh';
const STAGING_ID = '3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL';
const PRODUCTION_APPROVED_MINT = 'A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w';
const DEFAULT_APPROVED_MINT = '9ZefJZPJAK1d6v2iq1fXd2NFHjNULcXM9wMKD1f69p98';

describe('resolveProgramConfig', () => {
  it('defaults to stable and selects VITE_PROGRAM_ID', () => {
    const config = resolveProgramConfig({
      VITE_PROGRAM_ID: STABLE_ID,
      VITE_STAGING_PROGRAM_ID: STAGING_ID,
    });

    expect(config.stage).toBe('stable');
    expect(config.programId.toBase58()).toBe(STABLE_ID);
    expect(config.selectedKey).toBe('VITE_PROGRAM_ID');
    expect(config.approvedMasterCurrencyMint.toBase58()).toBe(PRODUCTION_APPROVED_MINT);
  });

  it('falls back to the baked-in stable program id when VITE_PROGRAM_ID is omitted', () => {
    const config = resolveProgramConfig({});

    expect(config.stage).toBe('stable');
    expect(config.programId.toBase58()).toBe(STABLE_ID);
    expect(config.selectedKey).toBe('VITE_PROGRAM_ID');
    expect(config.approvedMasterCurrencyMint.toBase58()).toBe(PRODUCTION_APPROVED_MINT);
  });

  it('selects VITE_STAGING_PROGRAM_ID when stage is staging', () => {
    const config = resolveProgramConfig({
      VITE_PROGRAM_STAGE: 'staging',
      VITE_PROGRAM_ID: STABLE_ID,
      VITE_STAGING_PROGRAM_ID: STAGING_ID,
    });

    expect(config.stage).toBe('staging');
    expect(config.programId.toBase58()).toBe(STAGING_ID);
    expect(config.selectedKey).toBe('VITE_STAGING_PROGRAM_ID');
    expect(config.approvedMasterCurrencyMint.toBase58()).toBe(DEFAULT_APPROVED_MINT);
  });

  it('throws a clear error when staging stage lacks a staging id', () => {
    expect(() =>
      resolveProgramConfig({
        VITE_PROGRAM_STAGE: 'staging',
        VITE_PROGRAM_ID: STABLE_ID,
      })
    ).toThrow('VITE_STAGING_PROGRAM_ID is required when VITE_PROGRAM_STAGE=staging');
  });

  it('throws a clear error for an unsupported stage', () => {
    expect(() =>
      resolveProgramConfig({
        VITE_PROGRAM_STAGE: 'qa',
        VITE_PROGRAM_ID: STABLE_ID,
        VITE_STAGING_PROGRAM_ID: STAGING_ID,
      })
    ).toThrow('VITE_PROGRAM_STAGE must be "stable" or "staging"');
  });

  it('throws a clear error when the selected program id is invalid', () => {
    expect(() =>
      resolveProgramConfig({
        VITE_PROGRAM_STAGE: 'stable',
        VITE_PROGRAM_ID: 'not-a-public-key',
        VITE_STAGING_PROGRAM_ID: STAGING_ID,
      })
    ).toThrow('VITE_PROGRAM_ID must be a valid Solana public key');
  });

  it('overrides the IDL address with the resolved program id', () => {
    const rewritten = withResolvedProgramAddress(
      {
        address: STABLE_ID,
        metadata: { name: 'openParametric' },
      },
      new PublicKey(STAGING_ID),
    );

    expect(rewritten.address).toBe(STAGING_ID);
    expect(rewritten.metadata).toEqual({ name: 'openParametric' });
  });
});
