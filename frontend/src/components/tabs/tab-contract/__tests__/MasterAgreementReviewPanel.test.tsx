import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/styles/theme';
import { useProtocolStore } from '@/store/useProtocolStore';
import { MasterAgreementReviewPanel } from '../MasterAgreementReviewPanel';

const mockUseMasterAgreementAccount = vi.fn();

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (params?.count != null) return `${key}:${params.count}`;
        return key;
      },
    }),
  };
});

vi.mock('@/hooks/useMasterAgreementAccount', () => ({
  useMasterAgreementAccount: (...args: unknown[]) => mockUseMasterAgreementAccount(...args),
}));

function renderSubject() {
  return render(
    <ThemeProvider theme={darkTheme}>
      <MasterAgreementReviewPanel selectedStep="basic" />
    </ThemeProvider>,
  );
}

describe('MasterAgreementReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProtocolStore.getState().resetAll();
    useProtocolStore.setState({
      mode: 'onchain',
      role: 'leader',
      masterAgreementPDA: '11111111111111111111111111111111',
      selectedMasterAgreementName: 'Fresh Optimistic Agreement Name',
      coverageStart: '2026-01-01',
      coverageEnd: '2026-12-31',
      premiumPerPolicy: 3,
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      leaderShare: 50,
      participants: [{ id: 'p1', name: 'Participant 1', share: 50, address: 'wallet-1', confirmed: false }],
      reinsurer: { enabled: false, address: '', confirmed: false },
      processStep: 1,
      masterActive: false,
    });
    mockUseMasterAgreementAccount.mockReturnValue({
      account: {
        name: 'Stale Backend Agreement Name',
      },
    });
  });

  it('prefers the fresher optimistic selected name over a stale account name', () => {
    renderSubject();

    expect(screen.getByText('Fresh Optimistic Agreement Name')).toBeInTheDocument();
    expect(screen.queryByText('Stale Backend Agreement Name')).not.toBeInTheDocument();
  });
});
