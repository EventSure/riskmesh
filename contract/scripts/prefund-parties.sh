#!/usr/bin/env bash
set -euo pipefail

EXPECTED_OPERATOR="J6fjC4edsm5VerYse7ceBG2kSX3TCPp89PifC3qACQWv"
EXPECTED_MINT_AUTHORITY="DojLvk7fFzqamyM8EE51PyQ3LWeQVrG3x67rbd5pXro2"
MINT_AUTHORITY_KEYPAIR="${HOME}/.config/solana/id.json"
MINT="A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w"

LEADER="GNPnwyRCCvo8wLEPwJEmzEjrqyhSXeyXvTbYibieHpYM"
PARTICIPANT_1="3BbfZXVnE1u4PVvv86ZoRkw8qMWvhCLZajvbPeg8EEWQ"
PARTICIPANT_2="Rg6m3GmEyayGjaJUv4qmp7iBVcg1owW6Az3ovWx6jxK"
REINSURER="H8rKuDFMz2xHTorQmLtJvEZhMVkZyAWiU8oWEZJ7uJMk"

AMOUNT_LEADER=2000
AMOUNT_PARTICIPANT_1=2000
AMOUNT_PARTICIPANT_2=2000
AMOUNT_REINSURER=2000

TOTAL_EXPECTED=$((AMOUNT_LEADER + AMOUNT_PARTICIPANT_1 + AMOUNT_PARTICIPANT_2 + AMOUNT_REINSURER))
TOTAL_MINT=8000

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

print_owner_accounts() {
  local label="$1"
  local owner="$2"

  print_section "${label} token accounts"
  spl-token accounts --owner "${owner}"
}

ensure_token_account() {
  local owner_label="$1"
  local owner="$2"
  local token_account="$3"

  if spl-token display "${token_account}" >/dev/null 2>&1; then
    return
  fi

  echo "Creating associated token account for ${owner_label} (${owner})"
  spl-token create-account "${MINT}" --owner "${owner}" --fee-payer "${CONFIG_PATH}"
}

transfer_to_owner() {
  local label="$1"
  local amount="$2"
  local owner="$3"

  echo "Transferring ${amount} ${MINT} tokens to ${label} (${owner})"
  spl-token transfer "${MINT}" "${amount}" "${owner}" \
    --owner "${CONFIG_PATH}" \
    --fee-payer "${CONFIG_PATH}" \
    --fund-recipient
}

require_command solana
require_command spl-token
require_command solana-keygen
require_file "${MINT_AUTHORITY_KEYPAIR}"

if [[ "${TOTAL_EXPECTED}" -ne "${TOTAL_MINT}" ]]; then
  echo "Configured total ${TOTAL_MINT} does not match transfer sum ${TOTAL_EXPECTED}" >&2
  exit 1
fi

CURRENT_OPERATOR="$(solana address)"
RPC_URL="$(solana config get | awk -F': ' '/RPC URL:/ {print $2}' | xargs)"
CONFIG_PATH="$(solana config get | awk -F': ' '/Keypair Path:/ {print $2}' | xargs)"
CURRENT_MINT_AUTHORITY="$(solana-keygen pubkey "${MINT_AUTHORITY_KEYPAIR}")"
OPERATOR_TOKEN_ACCOUNT="$(
  spl-token address --verbose --owner "${CURRENT_OPERATOR}" --token "${MINT}" \
    | awk -F': ' '/Associated token address:/ {print $2}'
)"

if [[ "${CURRENT_OPERATOR}" != "${EXPECTED_OPERATOR}" ]]; then
  echo "Expected operator ${EXPECTED_OPERATOR}, got ${CURRENT_OPERATOR}" >&2
  exit 1
fi

MINT_AUTHORITY="$(
  spl-token display "${MINT}" | awk -F': ' '/Mint authority:/ {print $2}' | tr -d '[:space:]'
)"

if [[ -z "${MINT_AUTHORITY}" ]]; then
  echo "Failed to resolve mint authority for ${MINT}" >&2
  exit 1
fi

if [[ "${MINT_AUTHORITY}" != "${EXPECTED_MINT_AUTHORITY}" ]]; then
  echo "Mint authority ${MINT_AUTHORITY} does not match expected authority ${EXPECTED_MINT_AUTHORITY}" >&2
  exit 1
fi

if [[ "${CURRENT_MINT_AUTHORITY}" != "${EXPECTED_MINT_AUTHORITY}" ]]; then
  echo "Mint authority keypair ${MINT_AUTHORITY_KEYPAIR} resolves to ${CURRENT_MINT_AUTHORITY}, expected ${EXPECTED_MINT_AUTHORITY}" >&2
  exit 1
fi

if [[ -z "${OPERATOR_TOKEN_ACCOUNT}" ]]; then
  echo "Failed to resolve operator associated token account for ${MINT}" >&2
  exit 1
fi

print_section "Prefund preflight"
echo "RPC URL        : ${RPC_URL}"
echo "CLI keypair    : ${CONFIG_PATH}"
echo "Operator       : ${CURRENT_OPERATOR}"
echo "Mint           : ${MINT}"
echo "Mint authority : ${MINT_AUTHORITY}"
echo "Mint signer    : ${MINT_AUTHORITY_KEYPAIR}"
echo "Operator ATA   : ${OPERATOR_TOKEN_ACCOUNT}"
echo "Leader         : ${LEADER} (${AMOUNT_LEADER})"
echo "Participant 1  : ${PARTICIPANT_1} (${AMOUNT_PARTICIPANT_1})"
echo "Participant 2  : ${PARTICIPANT_2} (${AMOUNT_PARTICIPANT_2})"
echo "Reinsurer      : ${REINSURER} (${AMOUNT_REINSURER})"
echo "Total mint     : ${TOTAL_MINT}"

print_section "Ensure operator token account"
ensure_token_account "operator" "${CURRENT_OPERATOR}" "${OPERATOR_TOKEN_ACCOUNT}"

print_section "Mint additional supply"
spl-token mint "${MINT}" "${TOTAL_MINT}" "${OPERATOR_TOKEN_ACCOUNT}" \
  --mint-authority "${MINT_AUTHORITY_KEYPAIR}" \
  --fee-payer "${CONFIG_PATH}"

print_section "Transfers"
transfer_to_owner "leader" "${AMOUNT_LEADER}" "${LEADER}"
transfer_to_owner "participant 1" "${AMOUNT_PARTICIPANT_1}" "${PARTICIPANT_1}"
transfer_to_owner "participant 2" "${AMOUNT_PARTICIPANT_2}" "${PARTICIPANT_2}"
transfer_to_owner "reinsurer" "${AMOUNT_REINSURER}" "${REINSURER}"

print_section "Operator balance"
spl-token balance "${MINT}"

print_owner_accounts "Operator" "${CURRENT_OPERATOR}"
print_owner_accounts "Leader" "${LEADER}"
print_owner_accounts "Participant 1" "${PARTICIPANT_1}"
print_owner_accounts "Participant 2" "${PARTICIPANT_2}"
print_owner_accounts "Reinsurer" "${REINSURER}"
