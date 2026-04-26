import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { createMint, getMint } from "@solana/spl-token";
import approvedMintKeypair from "./approvedMintKeypair.json";

export const LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(approvedMintKeypair)
);
export const LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT =
  LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT_KEYPAIR.publicKey;

export async function ensureApprovedMasterCurrencyMint(
  connection: Parameters<typeof getMint>[0],
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null = null,
  decimals = 6
): Promise<PublicKey> {
  const expectedMint = LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT;
  const configuredMint = process.env.OPEN_PARAMETRIC_APPROVED_MASTER_CURRENCY_MINT;

  if (configuredMint && configuredMint !== expectedMint.toBase58()) {
    throw new Error(
      `OPEN_PARAMETRIC_APPROVED_MASTER_CURRENCY_MINT must be ${expectedMint.toBase58()} for local tests, received ${configuredMint}`
    );
  }

  const mintAccount = await connection.getAccountInfo(expectedMint);
  if (mintAccount) {
    const mint = await getMint(connection, expectedMint);
    if (mint.decimals !== decimals) {
      throw new Error(
        `Approved test mint already exists with decimals=${mint.decimals}, expected ${decimals}`
      );
    }
    return expectedMint;
  }

  return createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals,
    LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT_KEYPAIR
  );
}
