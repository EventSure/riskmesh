import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { darkTheme } from '@/styles/theme';
import { PortalShell } from '../PortalShell';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

test('header, sidebar, children 렌더링', () => {
  wrap(
    <PortalShell
      header={<div>헤더</div>}
      sidebar={<div>사이드바</div>}
    >
      <div>메인콘텐츠</div>
    </PortalShell>,
  );
  expect(screen.getByText('헤더')).toBeInTheDocument();
  expect(screen.getByText('사이드바')).toBeInTheDocument();
  expect(screen.getByText('메인콘텐츠')).toBeInTheDocument();
});
