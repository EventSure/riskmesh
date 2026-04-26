import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import { vi, describe, beforeEach, expect, it } from 'vitest';
import { darkTheme } from '@/styles/theme';
import { ConfirmRole } from '@/lib/idl/open_parametric';
import { PortalConfirm } from '../PortalConfirm';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const mockToast = vi.fn();
const mockConfirmMaster = vi.fn();
const mockFundPool = vi.fn();
const mockUseProgram = vi.fn();
const mockUsePoolCollateralStatus = vi.fn();
const mockFetchMasterAgreement = vi.fn();
const mockRegisterInstruction = vi.fn();
const mockRegisterAccounts = vi.fn(() => ({ instruction: mockRegisterInstruction }));
const mockRegisterParticipantWallets = vi.fn(() => ({ accounts: mockRegisterAccounts }));
const mockLegacyConfirmInstruction = vi.fn();
const mockLegacyConfirmRpc = vi.fn();
const mockLegacyConfirmAccounts = vi.fn(() => ({
  instruction: mockLegacyConfirmInstruction,
  rpc: mockLegacyConfirmRpc,
}));
const mockLegacyConfirmMaster = vi.fn(() => ({ accounts: mockLegacyConfirmAccounts }));
const mockSystemCreateAccount = vi.fn();
const mockGetAssociatedTokenAddress = vi.fn();
const mockCreateAssociatedTokenAccountIdempotentInstruction = vi.fn();
const mockCreateInitializeAccount3Instruction = vi.fn();

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

vi.mock('@/hooks/useProgram', () => ({
  useProgram: () => mockUseProgram(),
}));

vi.mock('@/hooks/useConfirmMaster', () => ({
  useConfirmMaster: () => ({ confirmMaster: mockConfirmMaster, loading: false }),
}));

vi.mock('@/hooks/useFundPool', () => ({
  useFundPool: () => ({ fundPool: mockFundPool, loading: false }),
}));

vi.mock('@/hooks/usePoolCollateralStatus', () => ({
  usePoolCollateralStatus: (...args: unknown[]) => mockUsePoolCollateralStatus(...args),
}));

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  return {
    ...actual,
    SystemProgram: {
      ...actual.SystemProgram,
      createAccount: (...args: unknown[]) => mockSystemCreateAccount(...args),
    },
  };
});

vi.mock('@solana/spl-token', async () => {
  const actual = await vi.importActual<typeof import('@solana/spl-token')>('@solana/spl-token');
  return {
    ...actual,
    getAssociatedTokenAddress: (...args: unknown[]) => mockGetAssociatedTokenAddress(...args),
    createAssociatedTokenAccountIdempotentInstruction: (...args: unknown[]) =>
      mockCreateAssociatedTokenAccountIdempotentInstruction(...args),
    createInitializeAccount3Instruction: (...args: unknown[]) =>
      mockCreateInitializeAccount3Instruction(...args),
  };
});

const walletPublicKey = Keypair.generate().publicKey;
const masterPDA = Keypair.generate().publicKey;
const currencyMint = Keypair.generate().publicKey;
const existingParticipantPool = Keypair.generate().publicKey;
const reinsurerPool = Keypair.generate().publicKey;
const participantInsurer = walletPublicKey;
const reinsurerWallet = walletPublicKey;
const actorSourceToken = Keypair.generate().publicKey;

const baseParticipantInfo: ParticipantInfo = {
  role: 'participant',
  shareBps: 2500,
  confirmed: false,
  participantIndex: 0,
};

function bnLike(value: number) {
  return {
    toNumber: () => value,
    toString: () => String(value),
  };
}

function makeMasterData(overrides?: Record<string, unknown>) {
  return {
    currencyMint,
    coverageStartTs: bnLike(1_700_000_000),
    coverageEndTs: bnLike(1_700_086_400),
    premiumPerPolicy: bnLike(1_000_000),
    payoutDelay2H: bnLike(2_000_000),
    payoutDelay3H: bnLike(3_000_000),
    payoutDelay4To5H: bnLike(4_000_000),
    payoutDelay6HOrCancelled: bnLike(5_000_000),
    cededRatioBps: 5000,
    reinsCommissionBps: 1000,
    reinsurer: Keypair.generate().publicKey,
    reinsurerPoolWallet: reinsurerPool,
    participants: [
      {
        insurer: participantInsurer,
        shareBps: 2500,
        confirmed: false,
        poolWallet: existingParticipantPool,
        depositWallet: PublicKey.default,
      },
    ],
    ...overrides,
  };
}

function makeStatus(overrides?: Record<string, unknown>) {
  return {
    totalRequired: 100,
    totalFunded: 97,
    totalDeficit: 3,
    totalSurplus: 0,
    totalHealthPct: 97,
    aggregateReady: false,
    parties: [
      {
        id: 'participant-1',
        label: 'Participant 1',
        role: 'participant',
        shareBps: 2500,
        required: 12.345678,
        balance: 9.876543,
        deficit: 2.469135,
        surplus: 0,
        fundedPct: 80,
        confirmed: false,
        state: 'pending_confirm',
      },
    ],
    ...overrides,
  };
}

function renderPortalConfirm(props?: Partial<React.ComponentProps<typeof PortalConfirm>>) {
  return render(
    <ThemeProvider theme={darkTheme}>
      <PortalConfirm
        masterPDA={masterPDA}
        participantInfo={baseParticipantInfo}
        allRoles={[baseParticipantInfo]}
        onSuccess={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

let mockProvider: {
  connection: {
    getMinimumBalanceForRentExemption: ReturnType<typeof vi.fn>;
    getTokenAccountBalance: ReturnType<typeof vi.fn>;
  };
  sendAndConfirm: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();

  const dummyIx = new TransactionInstruction({
    keys: [],
    programId: TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });

  mockConfirmMaster.mockResolvedValue({ success: true, signature: 'confirm-sig' });
  mockFundPool.mockResolvedValue({ success: true, signature: 'fund-sig' });
  mockSystemCreateAccount.mockReturnValue(dummyIx);
  mockRegisterInstruction.mockResolvedValue(dummyIx);
  mockLegacyConfirmInstruction.mockResolvedValue(dummyIx);
  mockLegacyConfirmRpc.mockResolvedValue('legacy-confirm-sig');
  mockFetchMasterAgreement.mockResolvedValue(makeMasterData());
  mockGetAssociatedTokenAddress.mockResolvedValue(actorSourceToken);
  mockCreateAssociatedTokenAccountIdempotentInstruction.mockReturnValue(dummyIx);
  mockCreateInitializeAccount3Instruction.mockReturnValue(dummyIx);

  mockProvider = {
    connection: {
      getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(123456),
      getTokenAccountBalance: vi.fn().mockResolvedValue({ value: { amount: '18765433' } }),
    },
    sendAndConfirm: vi.fn().mockResolvedValue('setup-sig'),
  };

  mockUseProgram.mockReturnValue({
    wallet: { publicKey: walletPublicKey },
    provider: mockProvider,
    program: {
      account: {
        masterAgreement: {
          fetch: mockFetchMasterAgreement,
        },
      },
      methods: {
        registerParticipantWallets: mockRegisterParticipantWallets,
        confirmMaster: mockLegacyConfirmMaster,
      },
    },
  });

  mockUsePoolCollateralStatus.mockReturnValue({
    status: makeStatus(),
    activePartyId: 'participant-1',
    masterData: makeMasterData(),
  });
});

describe('PortalConfirm', () => {
  it('renders current collateral requirement, funded amount, deficit, and the deficit-aware confirm label', () => {
    renderPortalConfirm();

    expect(screen.getByText('portal.collateralRequired')).toBeInTheDocument();
    expect(screen.getByText('portal.collateralFunded')).toBeInTheDocument();
    expect(screen.getByText('portal.collateralDeficit')).toBeInTheDocument();
    expect(screen.getByText('12.35 USDC')).toBeInTheDocument();
    expect(screen.getByText('9.88 USDC')).toBeInTheDocument();
    expect(screen.getByText('2.47 USDC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'portal.confirmFundDeficitBtn' })).toBeInTheDocument();
  });

  it('reuses an existing participant pool wallet and confirms with the actor ATA plus pool token account', async () => {
    renderPortalConfirm();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'portal.confirmFundDeficitBtn' }));
    });

    await waitFor(() => {
      expect(mockRegisterParticipantWallets).not.toHaveBeenCalled();
      expect(mockProvider.sendAndConfirm).toHaveBeenCalledTimes(1);
      const confirmArgs = mockConfirmMaster.mock.calls[0]?.[0] as {
        masterAgreement: PublicKey;
        role: ConfirmRole;
        actorSourceToken: PublicKey;
        actorPoolToken: PublicKey;
      };
      expect(confirmArgs.masterAgreement.equals(masterPDA)).toBe(true);
      expect(confirmArgs.role).toBe(ConfirmRole.Participant);
      expect(confirmArgs.actorSourceToken.equals(actorSourceToken)).toBe(true);
      expect(confirmArgs.actorPoolToken.equals(existingParticipantPool)).toBe(true);
    });
  });

  it('creates and registers a participant pool token account when one is not registered yet', async () => {
    const emptyPool = PublicKey.default;
    const masterData = makeMasterData({
      participants: [{
        insurer: participantInsurer,
        shareBps: 2500,
        confirmed: false,
        poolWallet: emptyPool,
        depositWallet: PublicKey.default,
      }],
    });
    mockUsePoolCollateralStatus.mockReturnValue({
      status: makeStatus(),
      activePartyId: 'participant-1',
      masterData,
    });
    mockFetchMasterAgreement.mockResolvedValue(masterData);

    renderPortalConfirm();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'portal.confirmFundDeficitBtn' }));
    });

    await waitFor(() => {
      expect(mockRegisterParticipantWallets).toHaveBeenCalledTimes(1);
      expect(mockProvider.sendAndConfirm).toHaveBeenCalledTimes(1);
      const registerArgs = mockRegisterAccounts.mock.calls[0]?.[0] as {
        insurer: PublicKey;
        masterAgreement: PublicKey;
        poolWallet: PublicKey;
        depositWallet: PublicKey;
        tokenProgram: PublicKey;
      };
      expect(registerArgs).toEqual({
        insurer: walletPublicKey,
        masterAgreement: masterPDA,
        poolWallet: expect.any(PublicKey),
        depositWallet: expect.any(PublicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
      });
      const confirmArgs = mockConfirmMaster.mock.calls[0]?.[0] as {
        masterAgreement: PublicKey;
        role: ConfirmRole;
        actorSourceToken: PublicKey;
        actorPoolToken: PublicKey;
      };
      expect(confirmArgs.masterAgreement.equals(masterPDA)).toBe(true);
      expect(confirmArgs.role).toBe(ConfirmRole.Participant);
      expect(confirmArgs.actorSourceToken.equals(actorSourceToken)).toBe(true);
      expect(registerArgs.depositWallet.equals(actorSourceToken)).toBe(true);
      expect(confirmArgs.actorPoolToken.equals(registerArgs.poolWallet)).toBe(true);
    });
  });

  it('uses the registered reinsurer pool wallet for confirm and exposes exact-raw top-up for confirmed deficits', async () => {
    const participantInfo: ParticipantInfo = {
      role: 'rein',
      shareBps: 5000,
      confirmed: true,
      participantIndex: -1,
    };

    mockUsePoolCollateralStatus.mockReturnValue({
      status: {
        ...makeStatus({
          parties: [{
            id: 'reinsurer',
            label: 'Reinsurer',
            role: 'reinsurer',
            shareBps: 5000,
            required: 20,
            balance: 18.765433,
            deficit: 1.234567,
            surplus: 0,
            fundedPct: 93.8,
            confirmed: true,
            state: 'underfunded',
          }],
        }),
      },
      activePartyId: 'reinsurer',
      masterData: makeMasterData({ reinsurer: reinsurerWallet }),
    });

    renderPortalConfirm({ participantInfo, allRoles: [participantInfo] });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'portal.topUpDeficitBtn' }));
    });

    await waitFor(() => {
      expect(mockFundPool).toHaveBeenCalledTimes(1);
    });

    const topUpArgs = mockFundPool.mock.calls[0]?.[0] as {
      role: ConfirmRole;
      amountRaw: BN;
      actorSourceToken: PublicKey;
      actorPoolToken: PublicKey;
    };

    expect(topUpArgs.role).toBe(ConfirmRole.Reinsurer);
    expect(topUpArgs.actorSourceToken.equals(actorSourceToken)).toBe(true);
    expect(topUpArgs.actorPoolToken.equals(reinsurerPool)).toBe(true);
    expect(topUpArgs.amountRaw.toString()).toBe('1234567');
  });

  it('recomputes top-up from the live pool balance instead of the rendered stale deficit', async () => {
    const participantInfo: ParticipantInfo = {
      ...baseParticipantInfo,
      confirmed: true,
    };
    mockUsePoolCollateralStatus.mockReturnValue({
      status: makeStatus({
        parties: [{
          id: 'participant-1',
          label: 'Participant 1',
          role: 'participant',
          shareBps: 2500,
          required: 20,
          balance: 0,
          deficit: 20,
          surplus: 0,
          fundedPct: 0,
          confirmed: true,
          state: 'underfunded',
        }],
      }),
      activePartyId: 'participant-1',
      masterData: makeMasterData(),
    });
    mockProvider.connection.getTokenAccountBalance.mockResolvedValue({ value: { amount: '18765433' } });

    renderPortalConfirm({ participantInfo, allRoles: [participantInfo] });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'portal.topUpDeficitBtn' }));
    });

    await waitFor(() => {
      expect(mockFundPool).toHaveBeenCalledTimes(1);
    });

    const topUpArgs = mockFundPool.mock.calls[0]?.[0] as { amountRaw: BN };
    expect(topUpArgs.amountRaw.toString()).toBe('1234567');
  });

  it('reuses a locally registered participant pool for an immediate follow-up top-up', async () => {
    const emptyPool = PublicKey.default;
    const masterData = makeMasterData({
      participants: [{
        insurer: participantInsurer,
        shareBps: 2500,
        confirmed: false,
        poolWallet: emptyPool,
        depositWallet: PublicKey.default,
      }],
    });
    mockUsePoolCollateralStatus.mockReturnValue({
      status: makeStatus(),
      activePartyId: 'participant-1',
      masterData,
    });
    mockProvider.connection.getTokenAccountBalance.mockResolvedValue({ value: { amount: '11345678' } });

    renderPortalConfirm();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'portal.confirmFundDeficitBtn' }));
    });

    let firstPoolToken: PublicKey | undefined;
    await waitFor(() => {
      const registerArgs = mockRegisterAccounts.mock.calls[0]?.[0] as { poolWallet: PublicKey } | undefined;
      firstPoolToken = registerArgs?.poolWallet;
      expect(firstPoolToken).toBeInstanceOf(PublicKey);
      const confirmArgs = mockConfirmMaster.mock.calls[0]?.[0] as { actorPoolToken: PublicKey };
      expect(confirmArgs.actorPoolToken.equals(firstPoolToken!)).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'portal.topUpDeficitBtn' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'portal.topUpDeficitBtn' }));
    });

    await waitFor(() => {
      expect(mockFundPool).toHaveBeenCalledTimes(1);
    });

    const topUpArgs = mockFundPool.mock.calls[0]?.[0] as { actorPoolToken: PublicKey; amountRaw: BN };
    expect(mockRegisterParticipantWallets).toHaveBeenCalledTimes(1);
    expect(topUpArgs.actorPoolToken.equals(firstPoolToken!)).toBe(true);
    expect(topUpArgs.amountRaw.toString()).toBe('1000000');
  });
});
