import '@testing-library/jest-dom/vitest';
import { ThemeProvider } from '@emotion/react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { DashboardSidebar } from '../DashboardSidebar';
import i18n from '@/i18n';
import { useProtocolStore } from '@/store/useProtocolStore';
import { darkTheme } from '@/styles/theme';

const renderSubject = () =>
  render(
    <ThemeProvider theme={darkTheme}>
      <DashboardSidebar activeTab="tab-contract" onTabChange={() => {}} />
    </ThemeProvider>,
  );

describe('DashboardSidebar', () => {
  beforeEach(() => {
    useProtocolStore.getState().resetAll();
  });

  test('shows Help wording for the tools tab in English', async () => {
    await i18n.changeLanguage('en');

    renderSubject();

    const toolsSection = screen.getByText('도구').parentElement;
    expect(toolsSection).not.toBeNull();
    expect(within(toolsSection as HTMLElement).getByRole('button', { name: /Help/i })).toBeInTheDocument();
  });

  test('shows 도움말 wording for the tools tab in Korean', async () => {
    await i18n.changeLanguage('ko');

    renderSubject();

    const toolsSection = screen.getByText('도구').parentElement;
    expect(toolsSection).not.toBeNull();
    expect(within(toolsSection as HTMLElement).getByRole('button', { name: '도움말' })).toBeInTheDocument();
  });
});
