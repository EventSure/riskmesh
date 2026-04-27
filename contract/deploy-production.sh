#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PROD_ID="ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh"
DEVNET_URL="https://api.devnet.solana.com"

echo "==> Building (production ID: $PROD_ID)..."
touch programs/open_parametric/src/lib.rs
anchor build

echo "==> Upgrading production program on devnet..."
solana program deploy target/deploy/open_parametric.so \
  --program-id "$PROD_ID" \
  --upgrade-authority ~/.config/solana/id.json \
  --keypair ~/.config/solana/id.json \
  --url "$DEVNET_URL"

echo "==> Done. Production: $PROD_ID"
