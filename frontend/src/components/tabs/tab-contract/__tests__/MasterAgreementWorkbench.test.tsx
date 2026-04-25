import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
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

const renderSubject = () =>
  render(
    <ThemeProvider theme={darkTheme}>
      <TabContract />
    </ThemeProvider>,
  );

describe('TabContract workbench boundary', () => {
  test('shows master agreement workbench as the primary contract screen', () => {
    renderSubject();

    expect(screen.getByTestId('master-agreement-workbench')).toBeInTheDocument();
    expect(screen.getByTestId('master-agreement-review-panel')).toBeInTheDocument();
  });

  test('does not render auxiliary state, pool, or event log cards in contract tab', () => {
    renderSubject();

    expect(screen.queryByTestId('legacy-contract-step-panel')).not.toBeInTheDocument();
    expect(screen.queryByText(/Policy State Machine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pool 현황|Pool Status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/프로토콜 이벤트 로그|Protocol Event Log/i)).not.toBeInTheDocument();
  });
});
