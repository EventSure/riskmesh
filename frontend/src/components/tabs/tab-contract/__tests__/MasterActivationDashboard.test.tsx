import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { PublicKey } from '@solana/web3.js';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProtocolStore } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';
import { MasterActivationDashboard } from '../MasterActivationDashboard';

const mockUseMasterAgreementSnapshot = vi.fn();
const mockUseMasterAgreementAccount = vi.fn();
const mockUseMasterAgreementActivation = vi.fn();

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

vi.mock('@/components/tabs/shared/PoolHealthVisual', () => ({
  PoolHealthVisual: () => <div data-testid="pool-health-visual" />,
}));

vi.mock('@/hooks/useMasterAgreementSnapshot', () => ({
  useMasterAgreementSnapshot: (...args: unknown[]) => mockUseMasterAgreementSnapshot(...args),
}));

vi.mock('@/hooks/useMasterAgreementAccount', () => ({
  useMasterAgreementAccount: (...args: unknown[]) => mockUseMasterAgreementAccount(...args),
}));

vi.mock('@/hooks/useMasterAgreementActivation', () => ({
  useMasterAgreementActivation: (...args: unknown[]) => mockUseMasterAgreementActivation(...args),
}));

function renderSubject() {
  return render(
    <ThemeProvider theme={darkTheme}>
      <MasterActivationDashboard />
    </ThemeProvider>,
  );
}

function makeSnapshot() {
  return {
    agreementName: 'Master 2026',
    totalPremiumInflow: 0,
    totalClaimOutflow: 0,
    netBalance: 0,
    totalRequired: 15,
    totalFunded: 10,
    totalDeficit: 5,
    readinessPct: 66.7,
    blockers: ['leader'],
    blockerLabels: ['Leader'],
    aggregateReady: false,
  };
}

function makeStatus() {
  return {
    totalRequired: 15,
    totalFunded: 10,
    totalDeficit: 5,
    totalSurplus: 0,
    totalHealthPct: 66.7,
    aggregateReady: false,
    parties: [
      {
        id: 'leader',
        label: 'Leader',
        role: 'leader',
        shareBps: 5000,
        required: 10,
        balance: 5,
        deficit: 5,
        surplus: 0,
        fundedPct: 50,
        confirmed: true,
        state: 'underfunded',
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'simulation',
    role: 'leader',
    masterActive: false,
    processStep: 4,
    selectedMasterAgreementName: 'Master 2026',
    participants: [
      { id: 'p1', name: 'Participant 1', share: 30, address: 'wallet-1', confirmed: true },
      { id: 'p2', name: 'Participant 2', share: 20, address: 'wallet-2', confirmed: true },
    ],
    reinsurer: {
      enabled: true,
      name: 'Korean Re',
      address: 'wallet-re',
      confirmed: true,
    },
  });
  mockUseMasterAgreementAccount.mockReturnValue({
    account: null,
    loading: false,
    error: null,
  });
  mockUseMasterAgreementActivation.mockImplementation(() => ({
    activateLoading: false,
    canActivate: true,
    handleActivate: vi.fn(() => {
      useProtocolStore.getState().activateMaster();
    }),
  }));
  mockUseMasterAgreementSnapshot.mockReturnValue({
    snapshot: makeSnapshot(),
    status: makeStatus(),
    activePartyId: 'leader',
    masterData: { name: 'Master 2026' },
    loading: false,
    error: null,
    policyStatus: 'ready',
    policyError: null,
  });
});

describe('MasterActivationDashboard', () => {
  test('threads shared master account state into the activation snapshot and CTA hooks', () => {
    const sharedMasterAccount = { name: 'Master 2026' };
    useProtocolStore.setState({
      mode: 'onchain',
      masterAgreementPDA: '11111111111111111111111111111111',
    });
    mockUseMasterAgreementAccount.mockReturnValue({
      account: sharedMasterAccount,
      loading: true,
      error: 'master lag',
    });

    renderSubject();

    const [snapshotMasterKey, snapshotState] = mockUseMasterAgreementSnapshot.mock.calls[0];
    expect(snapshotMasterKey).toBeInstanceOf(PublicKey);
    expect((snapshotMasterKey as PublicKey).toBase58()).toBe('11111111111111111111111111111111');
    expect(snapshotState).toEqual({
      masterData: sharedMasterAccount,
      masterLoading: true,
      masterError: 'master lag',
    });

    expect(mockUseMasterAgreementActivation).toHaveBeenCalledWith({
      masterData: sharedMasterAccount,
      masterLoading: true,
      masterError: 'master lag',
    });
  });

  test('keeps the activation step actionable when activation is pending', () => {
    renderSubject();

    const activateButton = screen.getByRole('button', { name: 'confirm.activateBtn' });
    expect(activateButton).toBeEnabled();
    expect(activateButton).toHaveAttribute('data-guide', 'activate-btn');

    fireEvent.click(activateButton);

    expect(useProtocolStore.getState().masterActive).toBe(true);
    expect(useProtocolStore.getState().processStep).toBe(5);
  });

  test('disables the activation CTA in on-chain mode until the master account is loaded', () => {
    useProtocolStore.setState({
      mode: 'onchain',
      masterAgreementPDA: '11111111111111111111111111111111',
    });
    mockUseMasterAgreementAccount.mockReturnValue({
      account: null,
      loading: true,
      error: null,
    });
    mockUseMasterAgreementActivation.mockReturnValue({
      activateLoading: false,
      canActivate: false,
      handleActivate: vi.fn(),
    });

    renderSubject();

    expect(screen.getByRole('button', { name: 'confirm.activateBtn' })).toBeDisabled();
  });

  test('suppresses zero-valued money rows while policy data is still loading', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: makeSnapshot(),
      status: makeStatus(),
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: false,
      error: null,
      policyStatus: 'loading',
      policyError: null,
    });

    renderSubject();

    expect(screen.getByText('master.loading')).toBeInTheDocument();
    expect(screen.getByText('pool.healthAggregateActionNeeded')).toBeInTheDocument();
    expect(screen.getByText('15.00 USDC')).toBeInTheDocument();
    expect(screen.queryByText('0.00 USDC')).not.toBeInTheDocument();
  });

  test('replaces misleading money rows with the policy error state when policy data is unavailable', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: makeSnapshot(),
      status: makeStatus(),
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: false,
      error: null,
      policyStatus: 'error',
      policyError: 'policy fetch failed',
    });

    renderSubject();

    expect(screen.getByText('policy fetch failed')).toBeInTheDocument();
    expect(screen.getByText('pool.healthAggregateActionNeeded')).toBeInTheDocument();
    expect(screen.queryByText('0.00 USDC')).not.toBeInTheDocument();
  });

  test('shows a loading state instead of false deficits while collateral balances are unresolved', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: null,
      status: null,
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: true,
      error: null,
      policyStatus: 'ready',
      policyError: null,
    });

    renderSubject();

    expect(screen.getAllByText('master.loading').length).toBeGreaterThan(0);
    expect(screen.queryByText('pool.healthAggregateActionNeeded')).not.toBeInTheDocument();
    expect(screen.queryByText('5.00 USDC')).not.toBeInTheDocument();
  });

  test('keeps the dashboard in a loading state during the live-balance handoff before the snapshot resolves', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: null,
      status: null,
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: false,
      error: null,
      policyStatus: 'ready',
      policyError: null,
    });

    renderSubject();

    expect(screen.getAllByText('master.loading').length).toBeGreaterThan(0);
    expect(screen.queryByText('master.step3.empty')).not.toBeInTheDocument();
  });

  test('shows an unresolved state instead of synthetic deficits when balance reads fail', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: null,
      status: null,
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: false,
      error: 'balance read failed',
      policyStatus: 'ready',
      policyError: null,
    });

    renderSubject();

    expect(screen.getAllByText('balance read failed').length).toBeGreaterThan(0);
    expect(screen.queryByText('pool.healthAggregateActionNeeded')).not.toBeInTheDocument();
    expect(screen.queryByText('5.00 USDC')).not.toBeInTheDocument();
  });
});
