import { PublicKey } from '@solana/web3.js';

export type ProgramStage = 'stable' | 'staging';
export type ProgramEnvSource = 'VITE_PROGRAM_ID' | 'VITE_STAGING_PROGRAM_ID';

export interface ProgramEnv {
  readonly VITE_PROGRAM_STAGE?: string;
  readonly VITE_PROGRAM_ID?: string;
  readonly VITE_STAGING_PROGRAM_ID?: string;
}

export interface ProgramConfig {
  readonly stage: ProgramStage;
  readonly programId: PublicKey;
  readonly selectedKey: ProgramEnvSource;
  readonly approvedMasterCurrencyMint: PublicKey;
}

export interface AnchorProgramIdlLike {
  readonly address?: string;
  readonly metadata?: Record<string, unknown>;
}

const DEFAULT_STABLE_PROGRAM_ID = 'ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh';
const DEFAULT_APPROVED_MASTER_CURRENCY_MINT = '9ZefJZPJAK1d6v2iq1fXd2NFHjNULcXM9wMKD1f69p98';
const PRODUCTION_APPROVED_MASTER_CURRENCY_MINT = 'A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w';

export function resolveProgramConfig(env: ProgramEnv): ProgramConfig {
  const stage = env.VITE_PROGRAM_STAGE ?? 'stable';

  if (stage !== 'stable' && stage !== 'staging') {
    throw new Error('VITE_PROGRAM_STAGE must be "stable" or "staging"');
  }

  const selectedKey: ProgramEnvSource =
    stage === 'staging' ? 'VITE_STAGING_PROGRAM_ID' : 'VITE_PROGRAM_ID';
  const rawProgramId =
    selectedKey === 'VITE_STAGING_PROGRAM_ID'
      ? env.VITE_STAGING_PROGRAM_ID
      : env.VITE_PROGRAM_ID ?? DEFAULT_STABLE_PROGRAM_ID;

  if (!rawProgramId) {
    throw new Error(`${selectedKey} is required when VITE_PROGRAM_STAGE=${stage}`);
  }

  try {
    return {
      stage,
      programId: new PublicKey(rawProgramId),
      selectedKey,
      approvedMasterCurrencyMint: new PublicKey(
        stage === 'stable'
          ? PRODUCTION_APPROVED_MASTER_CURRENCY_MINT
          : DEFAULT_APPROVED_MASTER_CURRENCY_MINT,
      ),
    };
  } catch {
    throw new Error(`${selectedKey} must be a valid Solana public key`);
  }
}

export function withResolvedProgramAddress<T extends AnchorProgramIdlLike>(
  idl: T,
  programId: PublicKey,
): T & { address: string } {
  return {
    ...idl,
    address: programId.toBase58(),
  };
}
