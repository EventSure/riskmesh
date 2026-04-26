# Staging Run Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stable/staging run automation for frontend, backend, and contract demo scripts without changing contract deployment mechanics.

**Architecture:** Frontend uses npm scripts that set `VITE_PROGRAM_STAGE` before invoking Vite. Backend and contract use small POSIX shell wrappers that read local `.env` files safely without sourcing them, then export the active `PROGRAM_ID` only for the child process. Contract staging deployment remains out of scope because Solana program deployment needs aligned `declare_id!`, `Anchor.toml`, IDL, and program keypair handling.

**Tech Stack:** npm scripts, Vite env variables, Bash, Rust backend `dotenv`, Anchor TypeScript scripts.

---

## File Structure

- Modify: `frontend/package.json`
  - Add `dev:stable`, `dev:stage`, `build:stable`, and `build:stage`.
- Create: `frontend/src/lib/__tests__/packageScripts.test.ts`
  - Lock the frontend staging scripts so they keep setting `VITE_PROGRAM_STAGE`.
- Create: `backend/run-stable.sh`
  - Run backend using the active `PROGRAM_ID` from `backend/.env`.
- Create: `backend/run-staging.sh`
  - Read `STAGING_PROGRAM_ID` from `backend/.env`, export it as active `PROGRAM_ID`, then run backend.
- Create: `backend/scripts/__tests__/run-staging.sh`
  - Shell test for `backend/run-staging.sh` env parsing and missing-value failure.
- Modify: `contract/package.json`
  - Add generic `demo:stage` plus stage variants for the demo scripts that use contract `PROGRAM_ID`.
- Create: `contract/run-staging.sh`
  - Read `STAGING_PROGRAM_ID` from `contract/.env`, export it as active `PROGRAM_ID`, then dispatch an npm script.
- Create: `contract/scripts/__tests__/run-staging.sh`
  - Shell test for contract staging wrapper env parsing and missing-value failure.
- Modify: `frontend/docs/deployment-guide.md`
  - Replace “use `npm run dev` with env switching” with the new scripts.
- Modify: `docs/POLICY.md`
  - Record that runtime script automation exists, while contract deployment remains manual/separate.

## Non-Goals

- Do not implement `anchor deploy:stage`.
- Do not mutate `declare_id!`, `Anchor.toml`, or deploy keypairs.
- Do not edit `backend/deploy.sh`.
- Do not add new dependencies such as `cross-env`, `dotenv-cli`, `shellcheck`, `bats`, `make`, or `just`.

## Task 1: Frontend Stage Scripts

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/__tests__/packageScripts.test.ts`

- [ ] **Step 1: Write the failing package script test**

Create `frontend/src/lib/__tests__/packageScripts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import packageJson from '../../../package.json';

interface PackageJson {
  readonly scripts: { readonly [name: string]: string };
}

const frontendPackage = packageJson as PackageJson;

describe('frontend package staging scripts', () => {
  it('runs stable dev mode with the stable program stage', () => {
    expect(frontendPackage.scripts['dev:stable']).toBe('VITE_PROGRAM_STAGE=stable vite');
  });

  it('runs staging dev mode with the staging program stage', () => {
    expect(frontendPackage.scripts['dev:stage']).toBe('VITE_PROGRAM_STAGE=staging vite');
  });

  it('builds stable and staging bundles with explicit program stages', () => {
    expect(frontendPackage.scripts['build:stable']).toBe('VITE_PROGRAM_STAGE=stable npm run build');
    expect(frontendPackage.scripts['build:stage']).toBe('VITE_PROGRAM_STAGE=staging npm run build');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd frontend
npm test -- src/lib/__tests__/packageScripts.test.ts
```

Expected: FAIL because the new script keys are missing from `frontend/package.json`.

- [ ] **Step 3: Add frontend scripts**

Modify `frontend/package.json` scripts to include:

```json
"dev": "vite",
"dev:stable": "VITE_PROGRAM_STAGE=stable vite",
"dev:stage": "VITE_PROGRAM_STAGE=staging vite",
"build": "tsc -b && vite build",
"build:stable": "VITE_PROGRAM_STAGE=stable npm run build",
"build:stage": "VITE_PROGRAM_STAGE=staging npm run build",
```

Keep all existing scripts such as `preview`, `lint`, `sync-idl`, `test`, and `deploy`.

- [ ] **Step 4: Run focused and existing frontend tests**

Run:

```bash
cd frontend
npm test -- src/lib/__tests__/packageScripts.test.ts
npm test -- src/lib/__tests__/programEnv.test.ts
```

Expected: both commands pass. `programEnv.test.ts` remains the behavioral test for stage resolution.

- [ ] **Step 5: Commit frontend scripts**

```bash
git add frontend/package.json frontend/src/lib/__tests__/packageScripts.test.ts
git commit -m "Add frontend stable and staging run scripts" \
  -m "Frontend developers can now launch stable or staging mode without editing env files by hand for each run." \
  -m "Constraint: Avoid new dependencies; npm scripts use POSIX env assignment for the current macOS/Linux workflow" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: npm test -- src/lib/__tests__/packageScripts.test.ts; npm test -- src/lib/__tests__/programEnv.test.ts"
```

## Task 2: Backend Stable And Staging Run Wrappers

**Files:**
- Create: `backend/run-stable.sh`
- Create: `backend/run-staging.sh`
- Create: `backend/scripts/__tests__/run-staging.sh`
- Modify: `backend/.env.example`

- [ ] **Step 1: Write failing shell tests for backend staging wrapper**

Create directory `backend/scripts/__tests__` if missing, then create `backend/scripts/__tests__/run-staging.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: $needle" >&2
    echo "Actual output:" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

cat > "$TMP_DIR/.env" <<'ENV'
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
STAGING_PROGRAM_ID=3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL
ENV

output="$(BACKEND_ENV_FILE="$TMP_DIR/.env" BACKEND_PRINT_PROGRAM_ID=1 "$BACKEND_DIR/run-staging.sh")"
assert_contains "$output" "3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL"

cat > "$TMP_DIR/.env" <<'ENV'
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
STAGING_PROGRAM_ID=
ENV

if BACKEND_ENV_FILE="$TMP_DIR/.env" "$BACKEND_DIR/run-staging.sh" >/tmp/riskmesh-backend-stage-test.out 2>&1; then
  echo "Expected run-staging.sh to fail when STAGING_PROGRAM_ID is empty" >&2
  exit 1
fi
assert_contains "$(cat /tmp/riskmesh-backend-stage-test.out)" "STAGING_PROGRAM_ID is required"

echo "backend run-staging.sh tests passed"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
bash scripts/__tests__/run-staging.sh
```

Expected: FAIL because `backend/run-staging.sh` does not exist.

- [ ] **Step 3: Add backend run wrappers**

Create `backend/run-stable.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

exec cargo run -- "$@"
```

Create `backend/run-staging.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${BACKEND_ENV_FILE:-"$SCRIPT_DIR/.env"}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing backend env file: $ENV_FILE" >&2
  echo "Create backend/.env from backend/.env.example and set STAGING_PROGRAM_ID." >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(grep -m1 "^${key}=" "$ENV_FILE" | cut -d= -f2- || true)"
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

STAGING_PROGRAM_ID="$(read_env_value STAGING_PROGRAM_ID)"

if [[ -z "$STAGING_PROGRAM_ID" ]]; then
  echo "STAGING_PROGRAM_ID is required in $ENV_FILE" >&2
  exit 1
fi

if [[ "${BACKEND_PRINT_PROGRAM_ID:-}" == "1" ]]; then
  printf '%s\n' "$STAGING_PROGRAM_ID"
  exit 0
fi

cd "$SCRIPT_DIR"
PROGRAM_ID="$STAGING_PROGRAM_ID" exec cargo run -- "$@"
```

Make both executable:

```bash
chmod +x backend/run-stable.sh backend/run-staging.sh backend/scripts/__tests__/run-staging.sh
```

- [ ] **Step 4: Update backend env example with run commands**

In `backend/.env.example`, adjust the staging comment below `PROGRAM_ID` to:

```env
# Reference only. Backend reads PROGRAM_ID by default.
# Local staging run: ./run-staging.sh
# Local stable run: ./run-stable.sh
STAGING_PROGRAM_ID=
```

- [ ] **Step 5: Run backend wrapper tests and syntax checks**

Run:

```bash
cd backend
bash -n run-stable.sh run-staging.sh scripts/__tests__/run-staging.sh
bash scripts/__tests__/run-staging.sh
cargo test config
```

Expected: shell syntax checks pass, wrapper tests print `backend run-staging.sh tests passed`, and `cargo test config` passes with no failed tests.

- [ ] **Step 6: Commit backend wrappers**

```bash
git add backend/run-stable.sh backend/run-staging.sh backend/scripts/__tests__/run-staging.sh backend/.env.example
git commit -m "Add backend stable and staging run wrappers" \
  -m "Backend staging now has an explicit local entrypoint that maps the reference staging id to the active PROGRAM_ID for the process." \
  -m "Constraint: backend .env cannot be sourced directly because some values are not shell-safe" \
  -m "Rejected: Modify backend/deploy.sh | remote stable/staging container separation needs a separate deployment design" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: bash -n backend run scripts; bash backend/scripts/__tests__/run-staging.sh; cargo test config"
```

## Task 3: Contract Staging Demo Script Wrapper

**Files:**
- Create: `contract/run-staging.sh`
- Create: `contract/scripts/__tests__/run-staging.sh`
- Modify: `contract/package.json`
- Modify: `contract/.env.example`

- [ ] **Step 1: Write failing shell tests for contract staging wrapper**

Create `contract/scripts/__tests__/run-staging.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: $needle" >&2
    echo "Actual output:" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

cat > "$TMP_DIR/.env" <<'ENV'
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
STAGING_PROGRAM_ID=3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL
ENV

output="$(CONTRACT_ENV_FILE="$TMP_DIR/.env" CONTRACT_PRINT_PROGRAM_ID=1 "$CONTRACT_DIR/run-staging.sh" demo:3-master-setup)"
assert_contains "$output" "3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL"

cat > "$TMP_DIR/.env" <<'ENV'
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
STAGING_PROGRAM_ID=
ENV

if CONTRACT_ENV_FILE="$TMP_DIR/.env" "$CONTRACT_DIR/run-staging.sh" demo:3-master-setup >/tmp/riskmesh-contract-stage-test.out 2>&1; then
  echo "Expected run-staging.sh to fail when STAGING_PROGRAM_ID is empty" >&2
  exit 1
fi
assert_contains "$(cat /tmp/riskmesh-contract-stage-test.out)" "STAGING_PROGRAM_ID is required"

echo "contract run-staging.sh tests passed"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd contract
bash scripts/__tests__/run-staging.sh
```

Expected: FAIL because `contract/run-staging.sh` does not exist.

- [ ] **Step 3: Add contract staging wrapper**

Create `contract/run-staging.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${CONTRACT_ENV_FILE:-"$SCRIPT_DIR/.env"}"

if [[ $# -lt 1 ]]; then
  echo "Usage: ./run-staging.sh SCRIPT_NAME [-- script args]" >&2
  echo "Example: ./run-staging.sh demo:3-master-setup" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing contract env file: $ENV_FILE" >&2
  echo "Create contract/.env from contract/.env.example and set STAGING_PROGRAM_ID." >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(grep -m1 "^${key}=" "$ENV_FILE" | cut -d= -f2- || true)"
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

STAGING_PROGRAM_ID="$(read_env_value STAGING_PROGRAM_ID)"

if [[ -z "$STAGING_PROGRAM_ID" ]]; then
  echo "STAGING_PROGRAM_ID is required in $ENV_FILE" >&2
  exit 1
fi

if [[ "${CONTRACT_PRINT_PROGRAM_ID:-}" == "1" ]]; then
  printf '%s\n' "$STAGING_PROGRAM_ID"
  exit 0
fi

NPM_SCRIPT="$1"
shift

cd "$SCRIPT_DIR"
PROGRAM_ID="$STAGING_PROGRAM_ID" exec npm run "$NPM_SCRIPT" -- "$@"
```

Make scripts executable:

```bash
chmod +x contract/run-staging.sh contract/scripts/__tests__/run-staging.sh
```

- [ ] **Step 4: Add contract npm staging scripts**

Modify `contract/package.json` scripts to add:

```json
"demo:stage": "./run-staging.sh",
"demo:3-master-setup:stage": "./run-staging.sh demo:3-master-setup",
"demo:4-flight-create:stage": "./run-staging.sh demo:4-flight-create",
"demo:5a-resolve:stage": "./run-staging.sh demo:5a-resolve",
"demo:5b-claim:stage": "./run-staging.sh demo:5b-claim",
"demo:6-settle:stage": "./run-staging.sh demo:6-settle",
"demo:manual-list:stage": "./run-staging.sh demo:manual-list",
"demo:manual-create-flight:stage": "./run-staging.sh demo:manual-create-flight",
"demo:manual-settle:stage": "./run-staging.sh demo:manual-settle"
```

Do not add `anchor deploy` staging scripts in this task.

- [ ] **Step 5: Update contract env example**

Replace the staging comment in `contract/.env.example` with:

```env
# Reference only. Scripts read active PROGRAM_ID.
# Staging helper: ./run-staging.sh demo:3-master-setup
# Generic npm helper: npm run demo:stage -- demo:3-master-setup
STAGING_PROGRAM_ID=
```

- [ ] **Step 6: Run contract wrapper tests and TypeScript check**

Run:

```bash
cd contract
bash -n run-staging.sh scripts/__tests__/run-staging.sh
bash scripts/__tests__/run-staging.sh
npx tsc -p tsconfig.json --noEmit
```

Expected: shell syntax checks pass, wrapper tests print `contract run-staging.sh tests passed`, and TypeScript check passes.

- [ ] **Step 7: Commit contract wrapper**

```bash
git add contract/run-staging.sh contract/scripts/__tests__/run-staging.sh contract/package.json contract/.env.example
git commit -m "Add contract staging demo script wrapper" \
  -m "Contract demo scripts can now target the shared staging program by mapping STAGING_PROGRAM_ID to the active PROGRAM_ID for the child process." \
  -m "Constraint: Program deployment remains separate because deploy id, declare_id, Anchor.toml, and IDL must be aligned" \
  -m "Rejected: Add deploy:stage | unsafe without a dedicated program-keypair and IDL sync workflow" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: bash -n contract run scripts; bash contract/scripts/__tests__/run-staging.sh; npx tsc -p tsconfig.json --noEmit"
```

## Task 4: Documentation For Script Usage

**Files:**
- Modify: `frontend/docs/deployment-guide.md`
- Modify: `docs/POLICY.md`
- Modify: `README.md`
- Modify: `README.ko.md`

- [ ] **Step 1: Update frontend deployment guide commands**

In `frontend/docs/deployment-guide.md`, update the run command section to include:

````markdown
Frontend run scripts:

```bash
cd frontend
npm run dev:stable
npm run dev:stage
```

`dev:stage` only selects `VITE_PROGRAM_STAGE=staging`; `VITE_STAGING_PROGRAM_ID`
still must be set in `frontend/.env` or the shell environment.
```
````

Also add backend and contract local commands:

````markdown
Backend local run:

```bash
cd backend
./run-stable.sh
./run-staging.sh
```

Contract staging demo scripts:

```bash
cd contract
npm run demo:3-master-setup:stage
npm run demo:stage -- demo:manual-list
```

These helpers do not deploy a Solana program. Staging program deployment still
requires a separate deploy workflow that aligns the program keypair, `declare_id!`,
`Anchor.toml`, and generated IDL.
```
````

- [ ] **Step 2: Update policy**

Append or update a subsection in `docs/POLICY.md`:

```markdown
### Runtime Script Policy

Stable and staging runtime helpers may select the active program id for local
frontend, backend, and contract demo-script execution. They must not be treated
as program deployment automation.

- Frontend `dev:stage` selects `VITE_PROGRAM_STAGE=staging`.
- Backend `run-staging.sh` exports `PROGRAM_ID=$STAGING_PROGRAM_ID` for the backend process.
- Contract `run-staging.sh` exports `PROGRAM_ID=$STAGING_PROGRAM_ID` for the selected npm script.
- Solana program deployment remains a separate workflow because the deployed
  program id must match `declare_id!`, `Anchor.toml`, the IDL address, and the
  program keypair.
```

- [ ] **Step 3: Update README index descriptions**

Update `README.md` and `README.ko.md` frontend deployment guide descriptions to mention stable/staging run scripts:

```markdown
Frontend + contract deployment checklist with env-based program selection and stable/staging run scripts
```

For Korean README:

```markdown
env 기반 program selection과 stable/staging 실행 스크립트를 포함한 프런트엔드 + 컨트랙트 배포 체크리스트
```

- [ ] **Step 4: Run documentation checks**

Run:

```bash
rg -n "dev:stage|run-staging|deploy:stage|declare_id|Anchor.toml|VITE_STAGING_PROGRAM_ID" frontend/docs/deployment-guide.md docs/POLICY.md README.md README.ko.md
git diff --check
```

Expected: docs mention runtime staging helpers and clearly state no `deploy:stage` exists in this task.

- [ ] **Step 5: Commit docs**

```bash
git add frontend/docs/deployment-guide.md docs/POLICY.md README.md README.ko.md
git commit -m "Document stable and staging runtime scripts" \
  -m "Documentation now shows how to run frontend, backend, and contract demo scripts against staging without implying contract deployment automation." \
  -m "Constraint: Staging deploy automation is excluded until program-id/keypair/IDL handling is designed" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: rg runtime script docs; git diff --check"
```

## Task 5: Final Verification

**Files:**
- Verify all changed files from Tasks 1-4.

- [ ] **Step 1: Run frontend tests and build**

Run:

```bash
cd frontend
npm test
npm run build:stable
```

Expected: all tests pass and stable build exits 0.

- [ ] **Step 2: Verify staging build fails clearly until staging id is set**

Run:

```bash
cd frontend
npm run build:stage
```

Expected if `VITE_STAGING_PROGRAM_ID` is blank: FAIL with `VITE_STAGING_PROGRAM_ID is required when VITE_PROGRAM_STAGE=staging`.

Then run with a valid staging id override:

```bash
cd frontend
VITE_STAGING_PROGRAM_ID=3dBd52Do2ZBbaMboLyuVZSJTupAFKGoorEydQ6MkfiPL npm run build:stage
```

Expected: build exits 0.

- [ ] **Step 3: Run backend checks**

Run:

```bash
cd backend
bash -n run-stable.sh run-staging.sh scripts/__tests__/run-staging.sh
bash scripts/__tests__/run-staging.sh
cargo test config
```

Expected: shell checks and wrapper test pass; backend config tests have no failures.

- [ ] **Step 4: Run contract checks**

Run:

```bash
cd contract
bash -n run-staging.sh scripts/__tests__/run-staging.sh
bash scripts/__tests__/run-staging.sh
npx tsc -p tsconfig.json --noEmit
```

Expected: shell checks and wrapper test pass; TypeScript check exits 0.

- [ ] **Step 5: Verify git hygiene**

Run:

```bash
git diff --check HEAD
git status --short --branch
```

Expected: no whitespace errors. Worktree should be clean except ignored local `.env` files.

## Self-Review

- Spec coverage: frontend scripts are Task 1, backend scripts are Task 2, contract demo-script staging is Task 3, docs are Task 4, full verification is Task 5.
- Scope boundary: contract program deployment and `backend/deploy.sh` are explicitly out of scope.
- Type consistency: frontend continues using `VITE_PROGRAM_STAGE`; backend and contract wrappers both map `STAGING_PROGRAM_ID` to active `PROGRAM_ID`.
