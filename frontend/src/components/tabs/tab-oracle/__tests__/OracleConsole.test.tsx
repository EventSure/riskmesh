import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProtocolStore } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';
import { OracleConsole } from '../OracleConsole';

const mockToast = vi.fn();

vi.mock('@/components/common', async () => {
  const actual = await vi.importActual<typeof import('@/components/common')>('@/components/common');
  return {
    ...actual,
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('@/hooks/useProgram', () => ({
  useProgram: () => ({
    program: null,
    provider: null,
    wallet: null,
    connected: false,
  }),
}));

vi.mock('@/hooks/useResolveFlightDelay', () => ({
  useResolveFlightDelay: () => ({
    resolveFlightDelay: vi.fn(),
    loading: false,
  }),
}));

const renderSubject = () => {
  render(
    <ThemeProvider theme={darkTheme}>
      <OracleConsole />
    </ThemeProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'simulation',
    masterActive: true,
    contracts: [
      {
        id: 1,
        name: 'Hong',
        flight: 'KE081',
        date: '2026-01-15',
        lNet: 0,
        participantNets: [],
        rNet: 0,
        status: 'active',
        ts: '00:00',
      },
    ],
    payoutTiers: { delay2h: 2, delay3h: 3, delay4to5h: 4, delay6hOrCancelled: 5 },
  });
});

describe('OracleConsole', () => {
  test('keeps the oracle trigger action in a sticky footer', () => {
    renderSubject();

    expect(screen.getByRole('button', { name: /Check Oracle & Create Claim/i })).toBeInTheDocument();
    expect(screen.getByTestId('oracle-action-footer')).toBeInTheDocument();
    expect(document.head.textContent).toContain('position:sticky');
  });
});
