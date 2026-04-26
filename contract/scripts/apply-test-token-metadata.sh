#!/usr/bin/env bash
set -euo pipefail

MINT="A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w"
RPC_URL="https://api.devnet.solana.com"
MINT_AUTHORITY_KEYPAIR="${HOME}/.config/solana/id.json"
EXPECTED_MINT_AUTHORITY="DojLvk7fFzqamyM8EE51PyQ3LWeQVrG3x67rbd5pXro2"

NAME="RiskMesh Test USDC"
SYMBOL="RMUSDC"
DESCRIPTION="RiskMesh frontend and local integration testing token on Solana devnet."

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    exit 1
  fi
}

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "Missing required file: ${path}" >&2
    exit 1
  fi
}

print_section() {
  local title="$1"
  printf '\n== %s ==\n' "${title}"
}

require_command npx
require_command solana-keygen
require_file "${MINT_AUTHORITY_KEYPAIR}"

CURRENT_MINT_AUTHORITY="$(solana-keygen pubkey "${MINT_AUTHORITY_KEYPAIR}")"
if [[ "${CURRENT_MINT_AUTHORITY}" != "${EXPECTED_MINT_AUTHORITY}" ]]; then
  echo "Mint authority keypair ${MINT_AUTHORITY_KEYPAIR} resolves to ${CURRENT_MINT_AUTHORITY}, expected ${EXPECTED_MINT_AUTHORITY}" >&2
  exit 1
fi

print_section "Token metadata preflight"
echo "Mint           : ${MINT}"
echo "RPC URL        : ${RPC_URL}"
echo "Mint authority : ${CURRENT_MINT_AUTHORITY}"
echo "Name           : ${NAME}"
echo "Symbol         : ${SYMBOL}"
echo "Description    : ${DESCRIPTION}"

ADD_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${ADD_OUTPUT_FILE}"' EXIT

print_section "Add metadata if missing"
npx -y @metaplex-foundation/cli toolbox token add-metadata "${MINT}" \
  --name "${NAME}" \
  --symbol "${SYMBOL}" \
  --description "${DESCRIPTION}" \
  -k "${MINT_AUTHORITY_KEYPAIR}" \
  -p "${MINT_AUTHORITY_KEYPAIR}" \
  -r "${RPC_URL}" 2>&1 | tee "${ADD_OUTPUT_FILE}"

if grep -Fq "Metadata already exists for this token" "${ADD_OUTPUT_FILE}"; then
  print_section "Update existing metadata"
  npx -y @metaplex-foundation/cli toolbox token update "${MINT}" \
    --name "${NAME}" \
    --symbol "${SYMBOL}" \
    --description "${DESCRIPTION}" \
    -k "${MINT_AUTHORITY_KEYPAIR}" \
    -p "${MINT_AUTHORITY_KEYPAIR}" \
    -r "${RPC_URL}"
fi

print_section "Current metadata summary"
npx -y @metaplex-foundation/cli toolbox token add-metadata "${MINT}" \
  --name "${NAME}" \
  --symbol "${SYMBOL}" \
  --description "${DESCRIPTION}" \
  -k "${MINT_AUTHORITY_KEYPAIR}" \
  -p "${MINT_AUTHORITY_KEYPAIR}" \
  -r "${RPC_URL}"
