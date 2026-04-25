import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { darkTheme } from '@/styles/theme';
import { PortalSidebar } from '../PortalSidebar';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

const kpis = [{ label: 'Pool Health', value: '92.4%', color: '#22C55E' }];
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'settlement', label: 'Settlement' },
];

test('역할명과 KPI 렌더링', () => {
  wrap(
    <PortalSidebar
      roleName="리더사"
      roleColor="#9945FF"
      kpis={kpis}
      tabs={tabs}
      activeTab="overview"
      onTabChange={() => {}}
    />,
  );
  expect(screen.getByText('리더사')).toBeInTheDocument();
  expect(screen.getByText('Pool Health')).toBeInTheDocument();
  expect(screen.getByText('92.4%')).toBeInTheDocument();
});

test('탭 클릭 시 onTabChange 호출', () => {
  const onTabChange = vi.fn();
  wrap(
    <PortalSidebar
      roleName="리더사"
      roleColor="#9945FF"
      kpis={kpis}
      tabs={tabs}
      activeTab="overview"
      onTabChange={onTabChange}
    />,
  );
  fireEvent.click(screen.getByText('Settlement'));
  expect(onTabChange).toHaveBeenCalledWith('settlement');
});
