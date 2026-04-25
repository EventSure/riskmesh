import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { darkTheme } from '@/styles/theme';
import { ActionBanner } from '../ActionBanner';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

test('title과 description 렌더링', () => {
  wrap(<ActionBanner severity="warning" title="경고 제목" description="경고 설명" />);
  expect(screen.getByText('경고 제목')).toBeInTheDocument();
  expect(screen.getByText('경고 설명')).toBeInTheDocument();
});

test('action 버튼 클릭 콜백', () => {
  const onClick = vi.fn();
  wrap(
    <ActionBanner
      severity="warning"
      title="T"
      description="D"
      action={{ label: '확인', onClick }}
    />,
  );
  fireEvent.click(screen.getByText('확인'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('action 없으면 버튼 미렌더링', () => {
  wrap(<ActionBanner severity="info" title="T" description="D" />);
  expect(screen.queryByRole('button')).toBeNull();
});
