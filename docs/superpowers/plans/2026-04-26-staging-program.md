# Staging Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared devnet staging program selection so frontend, backend, and contract scripts can target stable or staging programs without source edits.

**Architecture:** Frontend gets a small program-env resolver that selects one active `PROGRAM_ID` from `VITE_PROGRAM_STAGE=stable|staging`. Backend and contract scripts already use `PROGRAM_ID`; this plan documents and examples stable/staging env usage without changing their runtime selector model. Deployment docs stop telling developers to edit `constants.ts` directly.

**Tech Stack:** Vite, TypeScript, Vitest, Solana `PublicKey`, Rust backend env config, Anchor scripts.

---

## File Structure

- Create: `frontend/src/lib/__tests__/programEnv.test.ts`
  - Unit tests for stable/staging program id selection and fail-fast errors.
- Create: `frontend/src/lib/programEnv.ts`
  - Pure resolver for program env values. No React, wallet, or browser dependencies.
- Modify: `frontend/src/lib/constants.ts`
  - Replace hardcoded `PROGRAM_ID` with resolver output and export `PROGRAM_STAGE`.
- Modify: `frontend/.env.example`
  - Add `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`, and `VITE_STAGING_PROGRAM_ID`.
- Create or modify: `frontend/.env`
  - Mirror program env keys for local development if the file exists; create it if absent.
- Modify: `backend/.env.example`
  - Add `STAGING_PROGRAM_ID` and comments explaining how to run staging.
- Modify: `backend/.env.production.example`
  - Add `STAGING_PROGRAM_ID` as a documented non-active reference value.
- Create: `contract/.env.example`
  - Document `PROGRAM_ID`, `STAGING_PROGRAM_ID`, and `ANCHOR_PROVIDER_URL` for scripts.
- Modify: `frontend/docs/deployment-guide.md`
  - Replace direct `constants.ts` editing with env-based program selection.
- Modify: `docs/POLICY.md`
  - Add policy that layout-changing work validates on staging before stable upgrade.

## Task 1: Frontend Program Env Resolver Tests

**Files:**
- Create: `frontend/src/lib/__tests__/programEnv.test.ts`
- Test target: `frontend/src/lib/programEnv.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/__tests__/programEnv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveProgramConfig } from '../programEnv';

const STABLE_ID = 'ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh';
const STAGING_ID = '3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL';

describe('resolveProgramConfig', () => {
  it('defaults to stable and selects VITE_PROGRAM_ID', () => {
    const config = resolveProgramConfig({
      VITE_PROGRAM_ID: STABLE_ID,
      VITE_STAGING_PROGRAM_ID: STAGING_ID,
    });

    expect(config.stage).toBe('stable');
    expect(config.programId.toBase58()).toBe(STABLE_ID);
    expect(config.source).toBe('VITE_PROGRAM_ID');
  });

  it('selects VITE_STAGING_PROGRAM_ID when stage is staging', () => {
    const config = resolveProgramConfig({
      VITE_PROGRAM_STAGE: 'staging',
      VITE_PROGRAM_ID: STABLE_ID,
      VITE_STAGING_PROGRAM_ID: STAGING_ID,
    });

    expect(config.stage).toBe('staging');
    expect(config.programId.toBase58()).toBe(STAGING_ID);
    expect(config.source).toBe('VITE_STAGING_PROGRAM_ID');
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd frontend
npm test -- src/lib/__tests__/programEnv.test.ts
```

Expected: FAIL because `../programEnv` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add frontend/src/lib/__tests__/programEnv.test.ts
git commit -m "Test frontend program id stage selection" \
  -m "Frontend program selection needs explicit coverage before replacing the hardcoded program id." \
  -m "Constraint: Vite exposes frontend env through import.meta.env at build time" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: npm test -- src/lib/__tests__/programEnv.test.ts fails because resolver is missing" \
  -m "Not-tested: Resolver implementation not added yet"
```

## Task 2: Frontend Program Env Resolver Implementation

**Files:**
- Create: `frontend/src/lib/programEnv.ts`
- Modify: `frontend/src/lib/constants.ts`
- Test: `frontend/src/lib/__tests__/programEnv.test.ts`

- [ ] **Step 1: Implement the resolver**

Create `frontend/src/lib/programEnv.ts`:

```ts
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
```

- [ ] **Step 2: Wire constants to the resolver**

Modify the top of `frontend/src/lib/constants.ts`:

```ts
import { PublicKey } from '@solana/web3.js';
import { resolveProgramConfig } from './programEnv';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

const programConfig = resolveProgramConfig(import.meta.env);

export const PROGRAM_STAGE = programConfig.stage;
export const PROGRAM_ID_SOURCE = programConfig.source;
export const PROGRAM_ID = programConfig.programId;

export const CURRENCY_MINT = new PublicKey('5YsAiRYU3tTFc5B8aaGwVL1oC9DVxBEddnXCaHcQQg2k');
```

Keep the existing policy/status constants below unchanged.

- [ ] **Step 3: Run the focused test**

Run:

```bash
cd frontend
npm test -- src/lib/__tests__/programEnv.test.ts
```

Expected: PASS for all `resolveProgramConfig` tests.

- [ ] **Step 4: Run existing PDA tests**

Run:

```bash
cd frontend
npm test -- src/lib/__tests__/pda.test.ts
```

Expected: PASS. This verifies default PDA helpers still import the exported active `PROGRAM_ID`.

- [ ] **Step 5: Commit resolver implementation**

```bash
git add frontend/src/lib/programEnv.ts frontend/src/lib/constants.ts
git commit -m "Select frontend program id from stage env" \
  -m "The frontend now resolves one active program id from stable or staging env values before PDA derivation and hook usage." \
  -m "Constraint: PDA helpers and Anchor calls must use the same selected program id" \
  -m "Rejected: Continue editing constants.ts by hand | easy to desynchronize stable and staging runs" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: npm test -- src/lib/__tests__/programEnv.test.ts; npm test -- src/lib/__tests__/pda.test.ts"
```

## Task 3: Env Examples For Frontend, Backend, And Contract

**Files:**
- Modify: `frontend/.env.example`
- Create or modify: `frontend/.env`
- Modify: `backend/.env.example`
- Modify: `backend/.env.production.example`
- Create: `contract/.env.example`

- [ ] **Step 1: Update frontend env examples**

Replace `frontend/.env.example` with:

```env
VITE_BACKEND_URL=http://localhost:3000

# Program selection
# stable  -> VITE_PROGRAM_ID
# staging -> VITE_STAGING_PROGRAM_ID
VITE_PROGRAM_STAGE=stable
VITE_PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
VITE_STAGING_PROGRAM_ID=
```

If `frontend/.env` exists, add the same keys while preserving any local-only
values already present. If it does not exist, create:

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_PROGRAM_STAGE=stable
VITE_PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
VITE_STAGING_PROGRAM_ID=
```

- [ ] **Step 2: Update backend env examples**

In `backend/.env.example`, keep existing values and add this directly below `PROGRAM_ID`:

```env
# Stable devnet program is the default active program. To run against staging,
# set PROGRAM_ID to the staging program id for this process.
STAGING_PROGRAM_ID=
```

In `backend/.env.production.example`, keep existing values and add this directly below `PROGRAM_ID`:

```env
# Reference only. Production/stable processes should keep PROGRAM_ID set to the
# active stable program id unless intentionally validating staging.
STAGING_PROGRAM_ID=
```

- [ ] **Step 3: Add contract env example**

Create `contract/.env.example`:

```env
# Anchor scripts
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

# Stable devnet program. Contract scripts use PROGRAM_ID when deriving PDAs.
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh

# Shared devnet staging program. To run scripts against staging:
# PROGRAM_ID=$STAGING_PROGRAM_ID npm run demo:3-master-setup
STAGING_PROGRAM_ID=
```

- [ ] **Step 4: Verify env files are visible or intentionally ignored**

Run:

```bash
git status --short --untracked-files=all frontend/.env frontend/.env.example backend/.env.example backend/.env.production.example contract/.env.example
```

Expected: `.env.example` files are visible. If `frontend/.env` is ignored, do not force-add it unless the repository already tracks `.env` files; the user asked to update local `.env`, not necessarily commit secrets-bearing env files.

- [ ] **Step 5: Commit env example updates**

```bash
git add frontend/.env.example backend/.env.example backend/.env.production.example contract/.env.example
git commit -m "Document stable and staging program env" \
  -m "Frontend, backend, and contract scripts now expose the same stable/staging program id vocabulary in their env examples." \
  -m "Constraint: Local .env may be ignored and should not be force-added if it can contain developer-specific values" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: git status --short --untracked-files=all for env files" \
  -m "Not-tested: No runtime behavior changed in this task"
```

## Task 4: Deployment And Policy Documentation

**Files:**
- Modify: `frontend/docs/deployment-guide.md`
- Modify: `docs/POLICY.md`

- [ ] **Step 1: Replace direct frontend source editing guidance**

In `frontend/docs/deployment-guide.md`, replace the checklist row and section that instruct developers to edit `src/lib/constants.ts` for `PROGRAM_ID` with env-based guidance:

```markdown
| 1 | `frontend/.env` and `frontend/.env.example` | Set `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`, and `VITE_STAGING_PROGRAM_ID` |
```

Add this section before the currency mint section:

````markdown
## Program ID selection

The frontend selects one active program id from environment variables:

```env
VITE_PROGRAM_STAGE=stable
VITE_PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
VITE_STAGING_PROGRAM_ID=
```

Use `VITE_PROGRAM_STAGE=staging` only after the shared devnet staging program
has been deployed and `VITE_STAGING_PROGRAM_ID` has been filled.

Do not edit `src/lib/constants.ts` to switch programs. PDA derivation and
Anchor calls must use the same active program id, and the env resolver keeps
that selection in one place.
```
````

Update the quick-start section to copy IDL and set env values instead of editing `constants.ts`.

- [ ] **Step 2: Add staging policy**

Append this section to `docs/POLICY.md`:

```markdown
## Program Staging Policy

`ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh` is the stable devnet program.
Layout-changing contract work, including changes to `MasterAgreement`, must be
validated against the shared devnet staging program before upgrading the stable
program.

Program id selection must be environment-driven:

- Frontend: `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`, `VITE_STAGING_PROGRAM_ID`
- Backend: active `PROGRAM_ID`, with `STAGING_PROGRAM_ID` documented as the staging reference
- Contract scripts: active `PROGRAM_ID`, with `STAGING_PROGRAM_ID` documented as the staging reference

When a program-id env variable is added or renamed, update the matching `.env`
and `.env.example` files together. Local `target/deploy/*-keypair.json` files
and `anchor keys list` are not authoritative because ignored build artifacts can
differ across worktrees.
```

- [ ] **Step 3: Run documentation checks**

Run:

```bash
rg -n "constants\\.ts.*PROGRAM_ID|PROGRAM_ID.*constants\\.ts|anchor keys list.*PROGRAM_ID" frontend/docs/deployment-guide.md docs/POLICY.md
```

Expected: No stale instruction remains telling developers to edit `constants.ts` or use `anchor keys list` as the program-id source of truth. Contextual troubleshooting mentions are acceptable only if they say not to use those as source of truth.

- [ ] **Step 4: Commit docs**

```bash
git add frontend/docs/deployment-guide.md docs/POLICY.md
git commit -m "Record staging program deployment policy" \
  -m "Deployment docs now describe env-based program selection and policy requires staging validation before stable upgrades for layout-changing work." \
  -m "Constraint: Existing stable devnet accounts may not deserialize after account layout changes" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: rg stale deployment instructions in deployment guide and policy"
```

## Task 5: Final Verification

**Files:**
- Verify all changed files from Tasks 1-4.

- [ ] **Step 1: Run frontend tests**

Run:

```bash
cd frontend
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build pass. Existing Vite/Rollup warnings are acceptable if the build exits with code 0.

- [ ] **Step 3: Verify backend config tests still pass**

Run:

```bash
cd backend
cargo test config
```

Expected: backend config-related tests pass. If there are no config-specific tests, run `cargo test` and record the result.

- [ ] **Step 4: Verify git hygiene**

Run:

```bash
git diff --check HEAD
git status --short
```

Expected: no whitespace errors. `git status --short` should show only intentionally uncommitted local `.env` changes if `.env` is ignored; otherwise it should be clean.

- [ ] **Step 5: Commit verification-only follow-up only if needed**

If verification requires a fix, commit the fix with a Lore-style message. If all verification passes without changes, do not create an empty commit.

## Self-Review

- Spec coverage: frontend selector, backend env flow, contract script env flow, IDL/deploy documentation, `.env` plus `.env.example` pairing, and staging-before-stable policy are each covered by Tasks 1-4.
- Placeholder scan: staging ids are intentionally represented as empty env values or `${STAGING_PROGRAM_ID}` shell references because the shared staging program has not been deployed yet.
- Type consistency: `ProgramStage`, `ProgramEnvSource`, `ProgramConfig`, and `resolveProgramConfig` are introduced in Task 2 and used consistently by `constants.ts`.
