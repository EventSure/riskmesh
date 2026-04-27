#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

KEYPAIR="keys/staging-keypair.json"
LIB_RS="programs/open_parametric/src/lib.rs"
PROD_ID="ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh"
DEVNET_URL="https://api.devnet.solana.com"

if [ ! -f "$KEYPAIR" ]; then
  echo "ERROR: $KEYPAIR not found."
  echo "Run: solana-keygen new --no-bip39-passphrase -o $KEYPAIR"
  exit 1
fi

STAGING_ID=$(solana-keygen pubkey "$KEYPAIR")
echo "==> Staging program ID: $STAGING_ID"

cleanup() {
  if [ -f "${LIB_RS}.bak" ]; then
    echo "==> Restoring lib.rs to production ID..."
    mv "${LIB_RS}.bak" "$LIB_RS"
  fi
}
trap cleanup EXIT

# 1) declare_id!를 staging ID로 교체
sed -i.bak "s/declare_id!(\"$PROD_ID\")/declare_id!(\"$STAGING_ID\")/" "$LIB_RS"

# 2) 빌드
echo "==> Building (staging ID: $STAGING_ID)..."
anchor build

# 3) devnet 배포 (초기 배포 or 업그레이드 자동 처리)
echo "==> Deploying staging to devnet..."
solana program deploy target/deploy/open_parametric.so \
  --program-id "$KEYPAIR" \
  --keypair ~/.config/solana/id.json \
  --url "$DEVNET_URL"

echo ""
echo "==> Staging deployed successfully."
echo ""
echo "Next — .env 파일에 아래 값을 채워주세요:"
echo "  contract/.env  : STAGING_PROGRAM_ID=$STAGING_ID"
echo "  frontend/.env  : VITE_STAGING_PROGRAM_ID=$STAGING_ID"
