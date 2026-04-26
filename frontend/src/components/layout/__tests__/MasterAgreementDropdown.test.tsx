import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/styles/theme';
import { useProtocolStore } from '@/store/useProtocolStore';
import { MasterAgreementDropdown } from '../MasterAgreementDropdown';

const mockUseMasterAgreements = vi.fn();

vi.mock('@/hooks/useProgram', () => ({
  useProgram: () => ({
    connected: true,
  }),
}));

vi.mock('@/hooks/useMasterAgreements', () => ({
  useMasterAgreements: () => mockUseMasterAgreements(),
}));

function renderSubject() {
  return render(
    <ThemeProvider theme={darkTheme}>
      <MasterAgreementDropdown />
    </ThemeProvider>,
  );
}

describe('MasterAgreementDropdown', () => {
  beforeEach(() => {
    useProtocolStore.getState().resetAll();
    useProtocolStore.setState({
      mode: 'onchain',
      masterAgreementPDA: null,
    });

    mockUseMasterAgreements.mockReturnValue({
      loading: false,
      refetch: vi.fn(),
      policies: [
        {
          pda: '8Fj2kP9aFake',
          name: '대한-뉴욕 2026 리더 공동계약',
          masterId: '1710000000',
          status: 2,
          statusLabel: 'Active',
          coverageEndTs: 1770000000,
          myRole: 'leader',
        },
      ],
    });
  });

  it('renders the official name before the fallback identifiers', async () => {
    renderSubject();

    expect(await screen.findByRole('option', { name: /대한-뉴욕 2026 리더 공동계약/ })).toBeInTheDocument();
  });

  it('syncs the selected operator role into the protocol store', () => {
    mockUseMasterAgreements.mockReturnValue({
      loading: false,
      refetch: vi.fn(),
      policies: [
        {
          pda: '9Op3r4t0rFake',
          name: '오퍼레이터 전용 공동계약',
          masterId: '1710000001',
          status: 2,
          statusLabel: 'Active',
          coverageEndTs: 1770000001,
          myRole: 'operator',
        },
      ],
    });

    renderSubject();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9Op3r4t0rFake' } });

    expect(useProtocolStore.getState().role).toBe('operator');
  });
});
