import { describe, expect, it, vi } from 'vitest';
import { putMasterAgreementDisplayNames } from '../insurerApi';

describe('putMasterAgreementDisplayNames', () => {
  it('posts participant and reinsurer display names to the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ master_policy_pubkey: 'master-1', participants: [], reinsurer: null }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await putMasterAgreementDisplayNames('master-1', {
      participants: [{ wallet: 'wallet-1', displayName: 'Samsung Life' }],
      reinsurer: { wallet: 'wallet-r', displayName: 'Korean Re' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/master-policies/master-1/display-names'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
