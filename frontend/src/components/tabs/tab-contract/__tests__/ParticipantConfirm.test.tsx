import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticipantConfirm } from '../ParticipantConfirm';
import { darkTheme } from '@/styles/theme';
import { useProtocolStore } from '@/store/useProtocolStore';
import { GUIDE_STEPS } from '@/components/guide/guideSteps';

const mockToast = vi.fn();
const mockActivateMasterOnChain = vi.fn();

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

function renderParticipantConfirm(onActivated = vi.fn()) {
  return render(
    <ThemeProvider theme={darkTheme}>
      <ParticipantConfirm onActivated={onActivated} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'onchain',
    role: 'leader',
    masterActive: false,
    participants: [
      { id: 'p1', name: 'Participant 1', share: 30, address: 'wallet-1', confirmed: true },
      { id: 'p2', name: 'Participant 2', share: 20, address: 'wallet-2', confirmed: true },
    ],
    reinsurer: { enabled: true, address: PublicKey.default.toBase58(), confirmed: true },
  });
  mockActivateMasterOnChain.mockResolvedValue({ success: true, signature: 'activate-sig' });
});

describe('ParticipantConfirm', () => {
  it('routes the guide tour through the Step 2 transition before the Step 3 activation CTA', () => {
    expect(GUIDE_STEPS.find((step) => step.step === 9)?.target).toBe('activate-transition-btn');
    expect(GUIDE_STEPS.find((step) => step.step === 10)?.target).toBe('activate-btn');
  });

  it('advances to the Step 3 dashboard when all confirmations are ready without activating on-chain', async () => {
    const onActivated = vi.fn();

    renderParticipantConfirm(onActivated);

    const transitionButton = screen.getByRole('button', { name: 'confirm.activateTransitionBtn' });
    expect(transitionButton).toBeEnabled();
    expect(transitionButton).toHaveAttribute('data-guide', 'activate-transition-btn');

    fireEvent.click(transitionButton);

    await waitFor(() => {
      expect(onActivated).toHaveBeenCalledTimes(1);
    });
    expect(mockActivateMasterOnChain).not.toHaveBeenCalled();
  });

  it('keeps Step 3 unavailable until every confirmation is complete', () => {
    useProtocolStore.setState({
      participants: [
        { id: 'p1', name: 'Participant 1', share: 30, address: 'wallet-1', confirmed: true },
        { id: 'p2', name: 'Participant 2', share: 20, address: 'wallet-2', confirmed: false },
      ],
    });
    const onActivated = vi.fn();

    renderParticipantConfirm(onActivated);

    const transitionButton = screen.getByRole('button', { name: 'confirm.activateTransitionBtn' });
    expect(transitionButton).toBeDisabled();

    fireEvent.click(transitionButton);

    expect(onActivated).not.toHaveBeenCalled();
    expect(mockActivateMasterOnChain).not.toHaveBeenCalled();
  });
});
