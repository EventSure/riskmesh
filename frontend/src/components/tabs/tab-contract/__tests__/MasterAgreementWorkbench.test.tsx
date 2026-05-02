import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProtocolStore, type Participant } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';
import { MasterAgreementWorkbench } from '../MasterAgreementWorkbench';

vi.mock('../ParticipantConfirm', () => ({
  ParticipantConfirm: ({ onActivated }: { onActivated?: () => void }) => (
    <section>
      <div>Mock participant step</div>
      <button type="button" onClick={() => onActivated?.()}>
        Mock activate
      </button>
    </section>
  ),
}));

vi.mock('../MasterActivationDashboard', () => ({
  MasterActivationDashboard: () => <section>Mock activation dashboard</section>,
}));

vi.mock('../MasterAgreementReviewPanel', () => ({
  MasterAgreementReviewPanel: ({ selectedStep }: { selectedStep: string }) => (
    <aside data-testid="selected-step">{selectedStep}</aside>
  ),
}));

vi.mock('@/hooks/useProgram', () => ({
  useProgram: () => ({
    program: null,
    provider: null,
    wallet: null,
    connected: false,
  }),
}));

const makeParticipants = (): Participant[] => [
  {
    id: 'p1',
    name: 'Hyundai Marine',
    share: 30,
    address: 'Part111111111111111111111111111111111111111',
    confirmed: true,
  },
  {
    id: 'p2',
    name: 'DB Insurance',
    share: 20,
    address: 'Part222222222222222222222222222222222222222',
    confirmed: false,
  },
];

const renderSubject = () =>
  render(
    <ThemeProvider theme={darkTheme}>
      <MasterAgreementWorkbench />
    </ThemeProvider>,
  );

beforeEach(() => {
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'simulation',
    processStep: 0,
    masterActive: false,
    coverageStart: '2026-01-01',
    coverageEnd: '2026-12-31',
    premiumPerPolicy: 3,
    payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
    leaderShare: 50,
    participants: makeParticipants(),
    reinsurer: {
      enabled: true,
      name: 'Korean Re',
      address: '',
      confirmed: false,
    },
    masterAgreementPDA: null,
  });
});

describe('MasterAgreementWorkbench', () => {
  test('renders the payout tier section and advances after setting terms', () => {
    renderSubject();

    expect(screen.getByTestId('selected-step')).toHaveTextContent('basic');
    expect(screen.getByTestId('payout-tier-grid')).toBeInTheDocument();
    expect(screen.getByText('Payout by Delay Tier')).toBeInTheDocument();
    expect(screen.getByText('2h~2h59m')).toBeInTheDocument();
    expect(screen.getByText('3h~3h59m')).toBeInTheDocument();
    expect(screen.getByText('4h~5h59m')).toBeInTheDocument();
    expect(screen.getByText('6h+ / Cancellation')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Set Terms & Rate/i }));

    expect(screen.getByText('Mock participant step')).toBeInTheDocument();
    expect(screen.getByTestId('selected-step')).toHaveTextContent('participants');
  }, 15000);

  test('lands on the activate step after the activation callback fires', () => {
    useProtocolStore.setState({
      processStep: 1,
    });

    renderSubject();

    expect(screen.getByText('Mock participant step')).toBeInTheDocument();
    expect(screen.getByTestId('selected-step')).toHaveTextContent('participants');

    fireEvent.click(screen.getByRole('button', { name: 'Mock activate' }));

    expect(screen.getByText('Mock activation dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('selected-step')).toHaveTextContent('activate');
  }, 15000);

  test('keeps the participant step selected until the Step 3 transition is used', () => {
    useProtocolStore.setState({
      processStep: 4,
      masterActive: false,
    });

    renderSubject();

    expect(screen.getByText('Mock participant step')).toBeInTheDocument();
    expect(screen.queryByText('Mock activation dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('selected-step')).toHaveTextContent('participants');

    fireEvent.click(screen.getByRole('button', { name: 'Mock activate' }));

    expect(screen.getByText('Mock activation dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('selected-step')).toHaveTextContent('activate');
  }, 15000);
});
