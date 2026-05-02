import { renderHook } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useMasterAgreementActivation } from '../useMasterAgreementActivation';

const mockUseProgram = vi.fn();
const mockUseActivateMaster = vi.fn();

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock('@/components/common', async () => {
  const actual = await vi.importActual<typeof import('@/components/common')>('@/components/common');
  return {
    ...actual,
    useToast: () => ({ toast: vi.fn() }),
  };
});

vi.mock('../useProgram', () => ({
  useProgram: () => mockUseProgram(),
}));

vi.mock('../useActivateMaster', () => ({
  useActivateMaster: () => mockUseActivateMaster(),
}));

function makeWallet(seed: number) {
  return new PublicKey(new Uint8Array(32).fill(seed));
}

function makeMasterData(operator: PublicKey) {
  return {
    operator,
    leaderPoolWallet: makeWallet(21),
    reinsurerPoolWallet: makeWallet(22),
    participants: [
      {
        poolWallet: makeWallet(23),
      },
    ],
  };
}

describe('useMasterAgreementActivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProtocolStore.getState().resetAll();
    useProtocolStore.setState({
      mode: 'onchain',
      role: 'leader',
      masterAgreementPDA: makeWallet(11).toBase58(),
      masterActive: false,
      participants: [
        { id: 'p1', name: 'Participant 1', share: 50, address: 'wallet-1', confirmed: true },
      ],
      reinsurer: {
        enabled: false,
        address: '',
        confirmed: false,
      },
    });
    mockUseActivateMaster.mockReturnValue({
      activateMaster: vi.fn(),
      loading: false,
    });
  });

  it('disables the on-chain activation CTA when the connected wallet is not the configured operator', () => {
    const operatorWallet = makeWallet(31);
    const leaderWallet = makeWallet(32);
    mockUseProgram.mockReturnValue({
      wallet: { publicKey: leaderWallet },
    });

    const { result } = renderHook(() => useMasterAgreementActivation({
      masterData: makeMasterData(operatorWallet) as never,
    }));

    expect(result.current.canActivate).toBe(false);
  });

  it('enables on-chain activation from the operator wallet even when the local role is stale', () => {
    const operatorWallet = makeWallet(41);
    mockUseProgram.mockReturnValue({
      wallet: { publicKey: operatorWallet },
    });

    const { result } = renderHook(() => useMasterAgreementActivation({
      masterData: makeMasterData(operatorWallet) as never,
    }));

    expect(result.current.canActivate).toBe(true);
  });

  it('preserves simulation activation behavior for leader-driven previews', () => {
    useProtocolStore.setState({
      mode: 'simulation',
      role: 'leader',
      masterAgreementPDA: null,
    });
    mockUseProgram.mockReturnValue({
      wallet: { publicKey: makeWallet(51) },
    });

    const { result } = renderHook(() => useMasterAgreementActivation());

    expect(result.current.canActivate).toBe(true);
  });
});
