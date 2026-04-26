import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { createMint, getMint } from "@solana/spl-token";

const LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT_SECRET = Uint8Array.from([
  120, 60, 53, 226, 208, 156, 208, 121, 120, 49, 237, 119, 151, 36, 13, 205,
  228, 81, 170, 103, 17, 226, 168, 7, 16, 15, 91, 94, 50, 19, 228, 189, 127, 58,
  169, 254, 169, 181, 8, 88, 5, 233, 172, 134, 63, 145, 165, 224, 106, 46, 111,
  52, 221, 213, 26, 12, 248, 35, 80, 186, 201, 111, 131, 195,
]);

export const LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT_KEYPAIR = Keypair.fromSecretKey(
  LOCAL_TEST_APPROVED_MASTER_CURRENCY_MINT_SECRET
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
