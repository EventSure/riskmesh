import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProtocolStore, type Participant } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';
import { MasterContractSetup } from '../MasterContractSetup';

const mockToast = vi.fn();
const mockSendAndConfirm = vi.fn();
const mockFetchMasterAgreement = vi.fn();
const mockInstruction = vi.fn();

vi.mock('@/components/common', async () => {
  const actual = await vi.importActual<typeof import('@/components/common')>('@/components/common');
  return {
    ...actual,
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('@/services/insurerApi', () => ({
  putMasterAgreementDisplayNames: vi.fn(),
}));

vi.mock('@/hooks/useProgram', () => ({
  useProgram: () => ({
    program: {
      methods: {
        createMasterAgreement: vi.fn(() => ({ accounts: vi.fn(() => ({ instruction: mockInstruction })) })),
        registerParticipantWallets: vi.fn(() => ({ accounts: vi.fn(() => ({ instruction: mockInstruction })) })),
        confirmMaster: vi.fn(() => ({ accounts: vi.fn(() => ({ instruction: mockInstruction })) })),
      },
      account: {
        masterAgreement: {
          fetch: mockFetchMasterAgreement,
        },
      },
    },
    provider: {
      connection: {
        getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(1),
      },
      sendAndConfirm: mockSendAndConfirm,
    },
    wallet: {
      publicKey: new PublicKey('11111111111111111111111111111111'),
    },
    connected: true,
  }),
}));

const makeParticipants = (): Participant[] => [
  {
    id: 'p1',
    name: 'Hyundai Marine',
    share: 50,
    address: 'BPFLoaderUpgradeab1e11111111111111111111111',
    confirmed: false,
  },
];

const renderSubject = (onTermsSet = vi.fn()) => {
  render(
    <ThemeProvider theme={darkTheme}>
      <MasterContractSetup onTermsSet={onTermsSet} />
    </ThemeProvider>,
  );
  return { onTermsSet };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInstruction.mockResolvedValue({
    keys: [],
    programId: new PublicKey('11111111111111111111111111111111'),
    data: Buffer.alloc(0),
  });
  mockSendAndConfirm.mockReset();
  mockFetchMasterAgreement.mockReset();
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'onchain',
    processStep: 0,
    masterActive: false,
    coverageStart: '2026-01-01',
    coverageEnd: '2026-12-31',
    premiumPerPolicy: 3,
    payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
    leaderShare: 50,
    participants: makeParticipants(),
    reinsurer: {
      enabled: false,
      name: '',
      address: '',
      confirmed: false,
    },
    masterAgreementPDA: null,
  });
});

describe('MasterContractSetup', () => {
  test('does not mark terms set when AlreadyProcessed cannot be verified on chain', async () => {
    mockSendAndConfirm.mockResolvedValueOnce('setup-sig').mockRejectedValueOnce(new Error('Transaction already been processed'));
    mockFetchMasterAgreement.mockRejectedValueOnce(new Error('Account does not exist'));
    const { onTermsSet } = renderSubject();

    fireEvent.click(screen.getByRole('button', { name: /Set Terms & Rate/i }));

    await waitFor(() => {
      expect(mockFetchMasterAgreement).toHaveBeenCalledTimes(1);
    });

    expect(onTermsSet).not.toHaveBeenCalled();
    expect(useProtocolStore.getState().processStep).toBe(0);
    expect(mockToast).toHaveBeenLastCalledWith(expect.stringContaining('TX failed'), 'd');
  }, 15000);

  test('marks terms set when AlreadyProcessed is verified by fetching the master account', async () => {
    mockSendAndConfirm.mockResolvedValueOnce('setup-sig').mockRejectedValueOnce(new Error('Transaction already been processed'));
    mockFetchMasterAgreement.mockResolvedValueOnce({ masterId: 1 });
    const { onTermsSet } = renderSubject();

    fireEvent.click(screen.getByRole('button', { name: /Set Terms & Rate/i }));

    await waitFor(() => {
      expect(onTermsSet).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchMasterAgreement).toHaveBeenCalledTimes(1);
    expect(useProtocolStore.getState().processStep).toBe(1);
    expect(mockToast).toHaveBeenLastCalledWith('Master policy 생성 완료 (tx 중복 확인)', 's');
  }, 15000);
});
