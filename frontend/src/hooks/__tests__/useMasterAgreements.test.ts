import { renderHook, waitFor } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMasterAgreements } from '../useMasterAgreements';

const mockUseWallet = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockUseWallet(),
}));

describe('useMasterAgreements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps operator wallet ownership to the operator role', async () => {
    const operator = new PublicKey('11111111111111111111111111111111');
    mockUseWallet.mockReturnValue({ publicKey: operator });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        master_agreements: [
          {
            pubkey: '8Fj2kP9aFake',
            master_id: 1710000000,
            name: '대한-뉴욕 2026 리더 공동계약',
            leader: 'Leader1111111111111111111111111111111111111',
            operator: operator.toBase58(),
            reinsurer: 'Rein111111111111111111111111111111111111111',
            status: 2,
            status_label: 'Active',
            coverage_end_ts: 1770000000,
            participants: [],
          },
        ],
      }),
    }));

    const { result } = renderHook(() => useMasterAgreements());

    await waitFor(() => {
      expect(result.current.policies).toHaveLength(1);
    });

    expect(result.current.policies[0]?.myRole).toBe('operator');
  });
});
