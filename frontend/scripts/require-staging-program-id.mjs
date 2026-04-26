import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PublicKey } from '@solana/web3.js';

const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
];

function parseEnvValue(line) {
  const [, rawValue = ''] = line.split(/=(.*)/s);
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readEnvFileValue(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return undefined;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (/^\s*VITE_STAGING_PROGRAM_ID\s*=/.test(line)) {
      return parseEnvValue(line);
    }
  }

  return undefined;
}

function resolveStagingProgramId() {
  if (process.env.VITE_STAGING_PROGRAM_ID !== undefined) {
    return process.env.VITE_STAGING_PROGRAM_ID.trim();
  }

  for (const fileName of envFiles) {
    const value = readEnvFileValue(fileName);
    if (value !== undefined) {
      return value.trim();
    }
  }

  return '';
}

const stagingProgramId = resolveStagingProgramId();

if (!stagingProgramId) {
  console.error('VITE_STAGING_PROGRAM_ID is required for staging frontend scripts.');
  process.exit(1);
}

try {
  new PublicKey(stagingProgramId);
} catch {
  console.error('VITE_STAGING_PROGRAM_ID must be a valid Solana public key.');
  process.exit(1);
}
