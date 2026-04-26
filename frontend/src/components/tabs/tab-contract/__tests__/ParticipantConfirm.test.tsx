import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Keypair, PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticipantConfirm } from '../ParticipantConfirm';
import { darkTheme } from '@/styles/theme';
import { useProtocolStore } from '@/store/useProtocolStore';

const mockToast = vi.fn();
const mockActivateMasterOnChain = vi.fn();
const mockUseMasterAgreementAccount = vi.fn();

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
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('@/hooks/useActivateMaster', () => ({
  useActivateMaster: () => ({
    activateMaster: mockActivateMasterOnChain,
    loading: false,
  }),
}));

vi.mock('@/hooks/useMasterAgreementAccount', () => ({
  useMasterAgreementAccount: (...args: unknown[]) => mockUseMasterAgreementAccount(...args),
}));

const masterAgreement = Keypair.generate().publicKey;
const leaderPoolWallet = Keypair.generate().publicKey;
const reinsurerPoolWallet = Keypair.generate().publicKey;
const participantPoolWallets = [Keypair.generate().publicKey, Keypair.generate().publicKey];

function renderParticipantConfirm() {
  return render(
    <ThemeProvider theme={darkTheme}>
      <ParticipantConfirm />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'onchain',
    role: 'leader',
    masterAgreementPDA: masterAgreement.toBase58(),
    masterActive: false,
    participants: [
      { id: 'p1', name: 'Participant 1', share: 30, address: participantPoolWallets[0].toBase58(), confirmed: true },
      { id: 'p2', name: 'Participant 2', share: 20, address: participantPoolWallets[1].toBase58(), confirmed: true },
    ],
    reinsurer: { enabled: true, address: PublicKey.default.toBase58(), confirmed: true },
  });
  mockUseMasterAgreementAccount.mockReturnValue({
    account: {
      leaderPoolWallet,
      reinsurerPoolWallet,
      participants: participantPoolWallets.map((poolWallet, index) => ({
        insurer: Keypair.generate().publicKey,
        shareBps: index === 0 ? 3000 : 2000,
        confirmed: true,
        poolWallet,
        depositWallet: Keypair.generate().publicKey,
      })),
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockActivateMasterOnChain.mockResolvedValue({ success: true, signature: 'activate-sig' });
});

describe('ParticipantConfirm', () => {
  it('passes leader, reinsurer, and participant pool accounts to on-chain activation', async () => {
    renderParticipantConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'confirm.activateBtn' }));

    await waitFor(() => {
      expect(mockActivateMasterOnChain).toHaveBeenCalledWith({
        masterAgreement,
        leaderPoolToken: leaderPoolWallet,
        reinsurerPoolToken: reinsurerPoolWallet,
        participantPoolTokens: participantPoolWallets,
      });
    });
  });

  it('uses leader pool as placeholder when the master has no reinsurer pool', async () => {
    useProtocolStore.setState({
      reinsurer: { enabled: false, address: '', confirmed: true },
    });
    mockUseMasterAgreementAccount.mockReturnValue({
      account: {
        leaderPoolWallet,
        reinsurerPoolWallet: null,
        participants: participantPoolWallets.map((poolWallet, index) => ({
          insurer: Keypair.generate().publicKey,
          shareBps: index === 0 ? 3000 : 2000,
          confirmed: true,
          poolWallet,
          depositWallet: Keypair.generate().publicKey,
        })),
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderParticipantConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'confirm.activateBtn' }));

    await waitFor(() => {
      expect(mockActivateMasterOnChain).toHaveBeenCalledWith({
        masterAgreement,
        leaderPoolToken: leaderPoolWallet,
        reinsurerPoolToken: leaderPoolWallet,
        participantPoolTokens: participantPoolWallets,
      });
    });
  });
});
