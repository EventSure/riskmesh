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
