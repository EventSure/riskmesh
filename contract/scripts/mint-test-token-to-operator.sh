#!/usr/bin/env bash
set -euo pipefail

EXPECTED_OPERATOR="J6fjC4edsm5VerYse7ceBG2kSX3TCPp89PifC3qACQWv"
EXPECTED_MINT_AUTHORITY="DojLvk7fFzqamyM8EE51PyQ3LWeQVrG3x67rbd5pXro2"
MINT_AUTHORITY_KEYPAIR="${HOME}/.config/solana/id.json"
MINT="A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w"
DEFAULT_AMOUNT=100000

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

require_command solana
require_command spl-token
require_command solana-keygen
require_file "${MINT_AUTHORITY_KEYPAIR}"

AMOUNT="${1:-$DEFAULT_AMOUNT}"
CURRENT_OPERATOR="$(solana address)"
RPC_URL="$(solana config get | awk -F': ' '/RPC URL:/ {print $2}' | xargs)"
CONFIG_PATH="$(solana config get | awk -F': ' '/Keypair Path:/ {print $2}' | xargs)"
CURRENT_MINT_AUTHORITY="$(solana-keygen pubkey "${MINT_AUTHORITY_KEYPAIR}")"
MINT_AUTHORITY_ONCHAIN="$(spl-token display "${MINT}" | awk -F': ' '/Mint authority:/ {print $2}' | tr -d '[:space:]')"
OPERATOR_TOKEN_ACCOUNT="$(
  spl-token address --verbose --owner "${CURRENT_OPERATOR}" --token "${MINT}" \
    | awk -F': ' '/Associated token address:/ {print $2}'
)"

if [[ "${CURRENT_OPERATOR}" != "${EXPECTED_OPERATOR}" ]]; then
  echo "Expected operator ${EXPECTED_OPERATOR}, got ${CURRENT_OPERATOR}" >&2
  exit 1
fi

if [[ "${CURRENT_MINT_AUTHORITY}" != "${EXPECTED_MINT_AUTHORITY}" ]]; then
  echo "Mint authority keypair ${MINT_AUTHORITY_KEYPAIR} resolves to ${CURRENT_MINT_AUTHORITY}, expected ${EXPECTED_MINT_AUTHORITY}" >&2
  exit 1
fi

if [[ "${MINT_AUTHORITY_ONCHAIN}" != "${EXPECTED_MINT_AUTHORITY}" ]]; then
  echo "On-chain mint authority ${MINT_AUTHORITY_ONCHAIN} does not match expected ${EXPECTED_MINT_AUTHORITY}" >&2
  exit 1
fi

print_section "Operator mint preflight"
echo "RPC URL        : ${RPC_URL}"
echo "CLI keypair    : ${CONFIG_PATH}"
echo "Operator       : ${CURRENT_OPERATOR}"
echo "Mint           : ${MINT}"
echo "Mint authority : ${CURRENT_MINT_AUTHORITY}"
echo "Operator ATA   : ${OPERATOR_TOKEN_ACCOUNT}"
echo "Mint amount    : ${AMOUNT}"

if ! spl-token display "${OPERATOR_TOKEN_ACCOUNT}" >/dev/null 2>&1; then
  print_section "Ensure operator token account"
  spl-token create-account "${MINT}" --owner "${CURRENT_OPERATOR}" --fee-payer "${CONFIG_PATH}"
fi

print_section "Mint to operator"
spl-token mint "${MINT}" "${AMOUNT}" "${OPERATOR_TOKEN_ACCOUNT}" \
  --mint-authority "${MINT_AUTHORITY_KEYPAIR}" \
  --fee-payer "${CONFIG_PATH}"

print_section "Operator token balance"
spl-token balance "${MINT}"

print_section "Operator token accounts"
spl-token accounts --owner "${CURRENT_OPERATOR}"
