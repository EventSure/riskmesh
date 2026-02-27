import { describe, it, expect, vi } from 'vitest';
import { shortenAddress, getExplorerUrl, sendTx } from '../tx';

describe('shortenAddress', () => {
  it('truncates with default 4 chars', () => {
    const addr = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABCD';
    expect(shortenAddress(addr)).toBe('AbCd...ABCD');
  });

  it('truncates with custom char count', () => {
    const addr = 'AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABCD';
    expect(shortenAddress(addr, 6)).toBe('AbCdEf...90ABCD');
  });

  it('handles short address', () => {
    expect(shortenAddress('AB', 4)).toBe('AB...AB');
  });
});

describe('getExplorerUrl', () => {
  const sig = 'abc123';

  it('generates tx URL for devnet (default)', () => {
    expect(getExplorerUrl(sig)).toBe(
      'https://explorer.solana.com/tx/abc123?cluster=devnet',
    );
  });

  it('generates address URL for devnet', () => {
    expect(getExplorerUrl(sig, 'address')).toBe(
      'https://explorer.solana.com/address/abc123?cluster=devnet',
    );
  });

  it('generates tx URL for mainnet-beta', () => {
    expect(getExplorerUrl(sig, 'tx', 'mainnet-beta')).toBe(
      'https://explorer.solana.com/tx/abc123?cluster=mainnet-beta',
    );
  });

  it('generates address URL for mainnet-beta', () => {
    expect(getExplorerUrl(sig, 'address', 'mainnet-beta')).toBe(
      'https://explorer.solana.com/address/abc123?cluster=mainnet-beta',
    );
  });
});

describe('sendTx', () => {
  it('returns success on resolved transaction', async () => {
    const mockProvider = {
      connection: {
        confirmTransaction: vi.fn().mockResolvedValue({}),
      },
    } as never;
    const txFn = vi.fn().mockResolvedValue('sig123');

    const result = await sendTx(mockProvider, txFn);
    expect(result).toEqual({ signature: 'sig123', success: true });
  });

  it('extracts Anchor error code from error message', async () => {
    const mockProvider = { connection: { confirmTransaction: vi.fn() } } as never;
    const txFn = vi.fn().mockRejectedValue(new Error('Transaction failed. Error Code: InsufficientFunds'));

    const result = await sendTx(mockProvider, txFn);
    expect(result).toEqual({ signature: '', success: false, error: 'InsufficientFunds' });
  });

  it('returns full message when no Anchor error code', async () => {
    const mockProvider = { connection: { confirmTransaction: vi.fn() } } as never;
    const txFn = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const result = await sendTx(mockProvider, txFn);
    expect(result).toEqual({ signature: '', success: false, error: 'Network timeout' });
  });

  it('handles non-Error thrown values', async () => {
    const mockProvider = { connection: { confirmTransaction: vi.fn() } } as never;
    const txFn = vi.fn().mockRejectedValue('string error');

    const result = await sendTx(mockProvider, txFn);
    expect(result).toEqual({ signature: '', success: false, error: 'string error' });
  });
});
