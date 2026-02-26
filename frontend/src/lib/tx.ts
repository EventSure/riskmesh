import type { AnchorProvider } from '@coral-xyz/anchor';

export interface TxResult {
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Send a transaction via Anchor provider and wait for confirmation.
 * Returns the signature and success status.
 */
export async function sendTx(
  provider: AnchorProvider,
  txFn: () => Promise<string>,
): Promise<TxResult> {
  try {
    const signature = await txFn();
    await provider.connection.confirmTransaction(signature, 'confirmed');
    return { signature, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Extract Anchor error code if present
    const anchorMatch = message.match(/Error Code: (\w+)/);
    const errorMsg = anchorMatch ? anchorMatch[1]! : message;
    return { signature: '', success: false, error: errorMsg };
  }
}

/**
 * Shorten a Solana address for display purposes.
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Get Solana Explorer URL for a transaction or account.
 */
export function getExplorerUrl(
  value: string,
  type: 'tx' | 'address' = 'tx',
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): string {
  return `https://explorer.solana.com/${type}/${value}?cluster=${cluster}`;
}
