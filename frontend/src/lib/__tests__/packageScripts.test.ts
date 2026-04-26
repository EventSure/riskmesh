import packageJson from '../../../package.json';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  readonly scripts: { readonly [name: string]: string };
}

const frontendPackage = packageJson as PackageJson;

describe('frontend package staging scripts', () => {
  it('runs stable dev mode with the stable program stage', () => {
    expect(frontendPackage.scripts['dev:stable']).toBe('VITE_PROGRAM_STAGE=stable vite');
  });

  it('runs staging dev mode with the staging program stage', () => {
    expect(frontendPackage.scripts['dev:stage']).toBe(
      'node scripts/require-staging-program-id.mjs && VITE_PROGRAM_STAGE=staging vite'
    );
  });

  it('builds stable and staging bundles with explicit program stages', () => {
    expect(frontendPackage.scripts['build:stable']).toBe('VITE_PROGRAM_STAGE=stable npm run build');
    expect(frontendPackage.scripts['build:stage']).toBe(
      'node scripts/require-staging-program-id.mjs && VITE_PROGRAM_STAGE=staging npm run build'
    );
  });
});
