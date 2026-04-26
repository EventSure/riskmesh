import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProtocolStore } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';
import { MasterActivationDashboard } from '../MasterActivationDashboard';

const mockUseMasterAgreementSnapshot = vi.fn();
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

vi.mock('@/hooks/useActivateMaster', () => ({
  useActivateMaster: () => ({
    activateMaster: vi.fn(),
    loading: false,
  }),
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
  mockUseMasterAgreementSnapshot.mockReturnValue({
    snapshot: makeSnapshot(),
    status: null,
    activePartyId: 'leader',
    masterData: { name: 'Master 2026' },
    loading: false,
    error: null,
    policyStatus: 'ready',
  });
});

describe('MasterActivationDashboard', () => {
  test('keeps the activation step actionable when activation is pending', () => {
    renderSubject();

    const activateButton = screen.getByRole('button', { name: 'confirm.activateBtn' });
    expect(activateButton).toBeEnabled();

    fireEvent.click(activateButton);

    expect(useProtocolStore.getState().masterActive).toBe(true);
    expect(useProtocolStore.getState().processStep).toBe(5);
  });

  test('suppresses zero-valued money rows while policy data is still loading', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: makeSnapshot(),
      status: null,
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: false,
      error: null,
      policyStatus: 'loading',
    });

    renderSubject();

    expect(screen.getByText('master.loading')).toBeInTheDocument();
    expect(screen.queryByText('0.00 USDC')).not.toBeInTheDocument();
  });

  test('replaces misleading money rows with the policy error state when policy data is unavailable', () => {
    mockUseMasterAgreementSnapshot.mockReturnValue({
      snapshot: makeSnapshot(),
      status: null,
      activePartyId: 'leader',
      masterData: { name: 'Master 2026' },
      loading: false,
      error: 'policy fetch failed',
      policyStatus: 'error',
    });

    renderSubject();

    expect(screen.getAllByText('policy fetch failed')).toHaveLength(2);
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
    });

    renderSubject();

    expect(screen.getAllByText('master.loading').length).toBeGreaterThan(0);
    expect(screen.queryByText('pool.healthAggregateActionNeeded')).not.toBeInTheDocument();
    expect(screen.queryByText('5.00 USDC')).not.toBeInTheDocument();
  });
});
