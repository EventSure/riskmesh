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
  readonly source: ProgramEnvSource;
}

const DEFAULT_STABLE_PROGRAM_ID = 'ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh';

export function resolveProgramConfig(env: ProgramEnv): ProgramConfig {
  const stage = env.VITE_PROGRAM_STAGE ?? 'stable';

  if (stage !== 'stable' && stage !== 'staging') {
    throw new Error('VITE_PROGRAM_STAGE must be "stable" or "staging"');
  }

  const source: ProgramEnvSource =
    stage === 'staging' ? 'VITE_STAGING_PROGRAM_ID' : 'VITE_PROGRAM_ID';
  const rawProgramId =
    source === 'VITE_STAGING_PROGRAM_ID'
      ? env.VITE_STAGING_PROGRAM_ID
      : env.VITE_PROGRAM_ID ?? DEFAULT_STABLE_PROGRAM_ID;

  if (!rawProgramId) {
    throw new Error(`${source} is required when VITE_PROGRAM_STAGE=${stage}`);
  }

  try {
    return {
      stage,
      programId: new PublicKey(rawProgramId),
      source,
    };
  } catch {
    throw new Error(`${source} must be a valid Solana public key`);
  }
}
