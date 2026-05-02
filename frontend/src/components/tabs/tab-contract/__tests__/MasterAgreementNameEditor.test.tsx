import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/styles/theme';
import { useProtocolStore } from '@/store/useProtocolStore';
import { MasterAgreementNameEditor } from '../MasterAgreementNameEditor';

const mockToast = vi.fn();
const mockRefetchAccount = vi.fn();
const mockRefetchPolicies = vi.fn();
const mockUpdateMasterAgreementName = vi.fn();
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
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('@/hooks/useMasterAgreementAccount', () => ({
  useMasterAgreementAccount: (...args: unknown[]) => mockUseMasterAgreementAccount(...args),
}));

vi.mock('@/hooks/useMasterAgreements', () => ({
  useMasterAgreements: () => ({
    refetch: mockRefetchPolicies,
  }),
}));

vi.mock('@/hooks/useUpdateMasterAgreementName', () => ({
  useUpdateMasterAgreementName: () => ({
    updateMasterAgreementName: mockUpdateMasterAgreementName,
    loading: false,
  }),
}));

function renderSubject() {
  return render(
    <ThemeProvider theme={darkTheme}>
      <MasterAgreementNameEditor />
    </ThemeProvider>,
  );
}

describe('MasterAgreementNameEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProtocolStore.getState().resetAll();
    useProtocolStore.setState({
      mode: 'onchain',
      role: 'leader',
      masterAgreementPDA: '11111111111111111111111111111111',
    });
    mockUseMasterAgreementAccount.mockReturnValue({
      account: {
        name: 'Old Agreement Name',
      },
      refetch: mockRefetchAccount,
    });
    mockUpdateMasterAgreementName.mockResolvedValue({
      success: true,
      signature: 'rename-sig',
    });
  });

  it('updates the visible selected name immediately and warns when refresh reconciliation fails', async () => {
    mockRefetchAccount.mockResolvedValue(false);
    mockRefetchPolicies.mockResolvedValue(true);

    renderSubject();

    fireEvent.change(screen.getByPlaceholderText('master.namePlaceholder'), {
      target: { value: 'New Agreement Name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'master.nameSave' }));

    await waitFor(() => {
      expect(mockUpdateMasterAgreementName).toHaveBeenCalled();
    });

    expect((useProtocolStore.getState() as unknown as { selectedMasterAgreementName?: string | null }).selectedMasterAgreementName).toBe('New Agreement Name');

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('master.nameSaved', 's');
      expect(mockToast).toHaveBeenCalledWith('master.nameSavedLocalWarning', 'w');
    });
  });

  it('resyncs the optimistic selected name when the fetched account publishes a newer authoritative rename', async () => {
    let authoritativeName = 'Old Agreement Name';
    useProtocolStore.setState({
      selectedMasterAgreementName: 'Optimistic Rename',
    });
    mockUseMasterAgreementAccount.mockImplementation(() => ({
      account: {
        name: authoritativeName,
      },
      refetch: mockRefetchAccount,
    }));

    const view = renderSubject();

    expect(screen.getByDisplayValue('Optimistic Rename')).toBeInTheDocument();

    authoritativeName = 'Authoritative Synced Rename';
    view.rerender(
      <ThemeProvider theme={darkTheme}>
        <MasterAgreementNameEditor />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Authoritative Synced Rename')).toBeInTheDocument();
    });
    expect(useProtocolStore.getState().selectedMasterAgreementName).toBe('Authoritative Synced Rename');
  });
});
