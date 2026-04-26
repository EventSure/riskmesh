import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import { useProtocolStore, type Participant } from '@/store/useProtocolStore';
import { ParticipationStructure } from '../ParticipationStructure';

const makeParticipants = (): Participant[] => [
  {
    id: 'p1',
    name: 'Hyundai Marine',
    share: 30,
    address: 'Part111111111111111111111111111111111111111',
    confirmed: false,
  },
];

const renderSubject = (mode: 'simulation' | 'onchain' = 'onchain') =>
  render(
    <ThemeProvider theme={theme}>
      <ParticipationStructure mode={mode} locked={false} />
    </ThemeProvider>,
  );

beforeEach(() => {
  useProtocolStore.getState().resetAll();
  useProtocolStore.setState({
    leaderShare: 70,
    participants: makeParticipants(),
    reinsurer: {
      enabled: true,
      name: 'Korean Re',
      address: 'Rein111111111111111111111111111111111111111',
      confirmed: false,
    },
  });
});

describe('ParticipationStructure', () => {
  it('keeps participant name, share, and wallet address in one editable party panel', () => {
    renderSubject('onchain');

    const panel = screen.getByTestId('participant-party-p1');
    expect(within(panel).getByDisplayValue('Hyundai Marine')).toBeInTheDocument();
    expect(within(panel).getByDisplayValue('30')).toBeInTheDocument();
    expect(within(panel).getByTestId('share-suffix-p1')).toHaveTextContent('%');
    expect(
      within(panel).getByDisplayValue('Part111111111111111111111111111111111111111'),
    ).toBeInTheDocument();
    expect(screen.getByText('Total: 100%')).toBeInTheDocument();
  }, 15000);

  it('includes reinsurer name, address, and fixed economics in the same participation flow', () => {
    renderSubject('onchain');

    const panel = screen.getByTestId('reinsurer-party');
    expect(within(panel).getByDisplayValue('Korean Re')).toBeInTheDocument();
    expect(
      within(panel).getByDisplayValue('Rein111111111111111111111111111111111111111'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Cession Rate')).toBeInTheDocument();
    expect(within(panel).getByText('Commission')).toBeInTheDocument();
    expect(within(panel).getByText('Net Cession')).toBeInTheDocument();
  }, 15000);

  it('strips leading zeros from share input immediately while typing', () => {
    renderSubject('onchain');

    const panel = screen.getByTestId('participant-party-p1');
    const shareInput = within(panel).getByDisplayValue('30');

    fireEvent.change(shareInput, { target: { value: '010' } });
    expect(within(panel).getByDisplayValue('10')).toBeInTheDocument();
    expect(useProtocolStore.getState().participants[0]?.share).toBe(10);
  }, 15000);

  it('normalizes share text input on blur after transient empty state', () => {
    renderSubject('onchain');

    const panel = screen.getByTestId('participant-party-p1');
    const shareInput = within(panel).getByDisplayValue('30');

    fireEvent.change(shareInput, { target: { value: '' } });
    expect(within(panel).getByDisplayValue('')).toBeInTheDocument();

    fireEvent.blur(shareInput);
    expect(within(panel).getByDisplayValue('0')).toBeInTheDocument();
    expect(useProtocolStore.getState().participants[0]?.share).toBe(0);
  }, 15000);
});
