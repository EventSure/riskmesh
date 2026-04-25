import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { darkTheme } from '@/styles/theme';
import { ParticipantChecklist } from '../ParticipantChecklist';

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

const entries = [
  { name: '참여사 A', shareBps: 3000, confirmed: true },
  { name: '참여사 B', shareBps: 2000, confirmed: false },
];

test('참여사 이름과 지분 렌더링', () => {
  wrap(<ParticipantChecklist entries={entries} />);
  expect(screen.getByText('참여사 A')).toBeInTheDocument();
  expect(screen.getByText('20.0%')).toBeInTheDocument();
});

test('확정 수 요약 표시', () => {
  wrap(<ParticipantChecklist entries={entries} />);
  expect(screen.getByText('1/2 Confirmed')).toBeInTheDocument();
});

test('전체 확정 시 요약 표시', () => {
  wrap(
    <ParticipantChecklist
      entries={[{ name: 'A', shareBps: 5000, confirmed: true }]}
    />,
  );
  expect(screen.getByText('1/1 Confirmed')).toBeInTheDocument();
});
