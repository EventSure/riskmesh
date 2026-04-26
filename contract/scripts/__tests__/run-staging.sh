#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR" /tmp/riskmesh-contract-stage-test.out' EXIT

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
