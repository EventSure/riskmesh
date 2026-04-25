import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import i18n from '@/i18n';
import { useProtocolStore, type Participant } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';
import { TabContract } from '../TabContract';

// Keep the boundary test focused on TabContract composition, not child runtime setup.
vi.mock('../ContractStepPanel', () => ({
  ContractStepPanel: () => (
    <section data-testid="legacy-contract-step-panel">Legacy setup panel</section>
  ),
}));

vi.mock('../StateMachine', () => ({
  StateMachine: () => <section>Policy State Machine</section>,
}));

vi.mock('../PoolStatus', () => ({
  PoolStatus: () => <section>Pool Status</section>,
}));

vi.mock('../EventLog', () => ({
  EventLog: () => <section>Protocol Event Log</section>,
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
      <TabContract />
    </ThemeProvider>,
  );

beforeEach(() => {
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    mode: 'onchain',
    processStep: 1,
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

describe('TabContract workbench boundary', () => {
  test('shows master agreement workbench as the primary contract screen', () => {
    renderSubject();

    expect(screen.getByTestId('master-agreement-workbench')).toBeInTheDocument();
    expect(screen.getByTestId('master-agreement-review-panel')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('master.review.coverage'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('master.review.premium'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('master.review.shareTotal'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('master.review.nextAction'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('master.review.next.confirmParticipants'))).toBeInTheDocument();
  });

  test('keeps participant approval as the next action until the reinsurer is confirmed', () => {
    useProtocolStore.setState({
      processStep: 3,
      participants: makeParticipants().map(participant => ({ ...participant, confirmed: true })),
      reinsurer: {
        enabled: true,
        name: 'Korean Re',
        address: '',
        confirmed: false,
      },
    });

    renderSubject();

    expect(screen.getByText(i18n.t('master.review.next.confirmParticipants'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('master.review.next.activate'))).not.toBeInTheDocument();
  });

  test('does not render auxiliary state, pool, or event log cards in contract tab', () => {
    renderSubject();

    expect(screen.queryByTestId('legacy-contract-step-panel')).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy State Machine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pool 현황|Pool Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/프로토콜 이벤트 로그|Protocol Event Log/i)).not.toBeInTheDocument();
  });
});
