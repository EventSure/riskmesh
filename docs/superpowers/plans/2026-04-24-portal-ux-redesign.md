# Portal UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/portal` 을 사이드바+메인 레이아웃 기반의 역할별 완전 분리 포탈 페이지로 재설계한다.

**Architecture:** `PortalPage.tsx`는 역할 감지 후 `LeaderPortal` / `ParticipantPortal` / `ReinPortal` / `OperatorPortal` 로 분기하는 라우터 역할만 담당한다. 각 역할 페이지는 공통 `PortalShell`(사이드바+메인 레이아웃) + `PortalSidebar` + `PortalHeader`를 공유하며, 메인 영역의 콘텐츠만 역할별로 다르다. 기존 탭 컴포넌트(`PortalOverview`, `PortalContracts` 등)는 그대로 유지하고 각 역할 페이지에서 import한다.

**Tech Stack:** React 19, Emotion styled, Zustand, react-i18next, @solana/wallet-adapter-react, Vitest + jsdom

---

## File Map

### 신규 생성
| 파일 | 역할 |
|------|------|
| `frontend/src/styles/theme.ts` | `darkTheme` / `lightTheme` 추가 (기존 수정) |
| `frontend/src/hooks/useThemeMode.ts` | 다크/라이트 토글 훅 + localStorage |
| `frontend/src/context/ThemeModeContext.ts` | 테마 모드 React Context |
| `frontend/src/components/layout/PortalShell.tsx` | 사이드바+메인 레이아웃 래퍼 |
| `frontend/src/components/layout/PortalSidebar.tsx` | 역할 배지 + KPI + 네비게이션 |
| `frontend/src/components/portal/ActionBanner.tsx` | 액션 알림 배너 |
| `frontend/src/components/portal/ParticipantChecklist.tsx` | 참여사 확정 현황 체크리스트 |
| `frontend/src/pages/portal/LeaderPortal.tsx` | 리더사 포탈 페이지 |
| `frontend/src/pages/portal/ParticipantPortal.tsx` | 참여사 포탈 페이지 |
| `frontend/src/pages/portal/ReinPortal.tsx` | 재보험사 포탈 페이지 |
| `frontend/src/pages/portal/OperatorPortal.tsx` | 운영사 포탈 페이지 |

### 수정
| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/styles/theme.ts` | `darkTheme` / `lightTheme` 분리 export |
| `frontend/src/App.tsx` | `ThemeModeContext.Provider` + 동적 테마 |
| `frontend/src/components/layout/PortalHeader.tsx` | 정책 선택기 드롭다운 + 테마 토글 버튼 추가 |
| `frontend/src/pages/PortalPage.tsx` | 역할 분기 라우터로 단순화 |
| `frontend/src/i18n/locales/ko.ts` | 신규 i18n 키 추가 |
| `frontend/src/i18n/locales/en.ts` | 신규 i18n 키 추가 |

---

## Task 1: 다크/라이트 테마 시스템

**Files:**
- Modify: `frontend/src/styles/theme.ts`
- Create: `frontend/src/hooks/useThemeMode.ts`
- Create: `frontend/src/context/ThemeModeContext.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/__tests__/useThemeMode.test.ts`

- [ ] **Step 1: theme.ts 수정 — darkTheme / lightTheme 분리**

`frontend/src/styles/theme.ts` 전체를 다음으로 교체:

```typescript
const baseTheme = {
  glow: {
    primary: 'rgba(153,69,255,0.25)',
    accent: 'rgba(20,241,149,0.25)',
    danger: 'rgba(239,68,68,0.25)',
    info: 'rgba(56,189,248,0.25)',
    warning: 'rgba(245,158,11,0.25)',
  },
  glowSubtle: {
    primary: 'rgba(153,69,255,0.10)',
    accent: 'rgba(20,241,149,0.10)',
    danger: 'rgba(239,68,68,0.08)',
    info: 'rgba(56,189,248,0.10)',
    warning: 'rgba(245,158,11,0.08)',
  },
  fonts: {
    sans: "'Space Grotesk', sans-serif",
    mono: "'DM Mono', monospace",
  },
  radii: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '16px',
    full: '50%',
    pill: '20px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '10px',
    lg: '12px',
    xl: '14px',
    xxl: '16px',
  },
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
  mediaQueries: {
    sm: '@media (min-width: 640px)',
    md: '@media (min-width: 768px)',
    lg: '@media (min-width: 1024px)',
    xl: '@media (min-width: 1280px)',
  },
} as const;

export const darkTheme = {
  ...baseTheme,
  mode: 'dark' as const,
  colors: {
    bg: '#0B1120',
    card: '#111827',
    card2: '#0d1626',
    surface1: '#111827',
    surface2: '#1A2332',
    surface3: '#0F1A2A',
    primary: '#9945FF',
    accent: '#14F195',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#38BDF8',
    text: '#F8FAFC',
    sub: '#94A3B8',
    border: '#1F2937',
    border2: '#263045',
  },
};

export const lightTheme = {
  ...baseTheme,
  mode: 'light' as const,
  colors: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    card2: '#F1F5F9',
    surface1: '#FFFFFF',
    surface2: '#F1F5F9',
    surface3: '#E2E8F0',
    primary: '#9945FF',
    accent: '#059669',
    danger: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    info: '#0284C7',
    text: '#0F172A',
    sub: '#64748B',
    border: '#E2E8F0',
    border2: '#CBD5E1',
  },
};

// 하위 호환: 기존 코드가 `theme`을 import하는 경우
export const theme = darkTheme;

export type Theme = typeof darkTheme;
```

- [ ] **Step 2: ThemeModeContext 생성**

`frontend/src/context/ThemeModeContext.ts` 신규 생성:

```typescript
import { createContext, useContext } from 'react';

interface ThemeModeContextValue {
  mode: 'dark' | 'light';
  toggle: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  toggle: () => {},
});

export function useThemeModeContext() {
  return useContext(ThemeModeContext);
}
```

- [ ] **Step 3: useThemeMode 훅 생성**

`frontend/src/hooks/useThemeMode.ts` 신규 생성:

```typescript
import { useState, useEffect } from 'react';

export function useThemeMode() {
  const [mode, setMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme-mode') as 'dark' | 'light') ?? 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const toggle = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));
  return { mode, toggle };
}
```

- [ ] **Step 4: App.tsx 수정 — 동적 테마 적용**

`App.tsx` 상단 import 교체:
```typescript
// 기존: import { theme } from '@/styles/theme';
import { darkTheme, lightTheme } from '@/styles/theme';
import { useThemeMode } from '@/hooks/useThemeMode';
import { ThemeModeContext } from '@/context/ThemeModeContext';
```

`App` 컴포넌트 내부 수정:
```typescript
export function App() {
  const { mode, toggle } = useThemeMode();
  const currentTheme = mode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
      <QueryProvider>
        <SolanaProvider>
          <ThemeProvider theme={currentTheme}>
            {/* 나머지 기존 코드 그대로 */}
```

- [ ] **Step 5: 테스트 작성**

`frontend/src/__tests__/useThemeMode.test.ts` 신규 생성:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useThemeMode } from '@/hooks/useThemeMode';

beforeEach(() => localStorage.clear());

test('기본값은 dark', () => {
  const { result } = renderHook(() => useThemeMode());
  expect(result.current.mode).toBe('dark');
});

test('toggle 시 light로 전환', () => {
  const { result } = renderHook(() => useThemeMode());
  act(() => result.current.toggle());
  expect(result.current.mode).toBe('light');
});

test('localStorage에 저장됨', () => {
  const { result } = renderHook(() => useThemeMode());
  act(() => result.current.toggle());
  expect(localStorage.getItem('theme-mode')).toBe('light');
});

test('localStorage에서 복원', () => {
  localStorage.setItem('theme-mode', 'light');
  const { result } = renderHook(() => useThemeMode());
  expect(result.current.mode).toBe('light');
});
```

- [ ] **Step 6: 테스트 실행 확인**

```bash
cd frontend && npx vitest run src/__tests__/useThemeMode.test.ts
```
Expected: 4 tests PASS

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/styles/theme.ts frontend/src/hooks/useThemeMode.ts frontend/src/context/ThemeModeContext.ts frontend/src/App.tsx frontend/src/__tests__/useThemeMode.test.ts
git commit -m "feat: 다크/라이트 테마 시스템 추가"
```

---

## Task 2: PortalShell 레이아웃 컴포넌트

**Files:**
- Create: `frontend/src/components/layout/PortalShell.tsx`
- Test: `frontend/src/components/layout/__tests__/PortalShell.test.tsx`

- [ ] **Step 1: PortalShell.tsx 생성**

```typescript
import styled from '@emotion/styled';
import type { ReactNode } from 'react';

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${p => p.theme.colors.bg};
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
`;

const Sidebar = styled.aside`
  width: 200px;
  flex-shrink: 0;
  background: ${p => p.theme.colors.card2};
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  min-height: calc(100vh - 48px);
`;

const Main = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  min-height: 0;
`;

interface PortalShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

export function PortalShell({ header, sidebar, children }: PortalShellProps) {
  return (
    <Shell>
      {header}
      <Body>
        <Sidebar>{sidebar}</Sidebar>
        <Main>{children}</Main>
      </Body>
    </Shell>
  );
}
```

- [ ] **Step 2: 테스트 작성**

`frontend/src/components/layout/__tests__/PortalShell.test.tsx`:

```typescript
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
```

- [ ] **Step 3: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/layout/__tests__/PortalShell.test.tsx
```
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/layout/PortalShell.tsx frontend/src/components/layout/__tests__/PortalShell.test.tsx
git commit -m "feat: PortalShell 레이아웃 컴포넌트 추가"
```

---

## Task 3: ActionBanner + ParticipantChecklist 컴포넌트

**Files:**
- Create: `frontend/src/components/portal/ActionBanner.tsx`
- Create: `frontend/src/components/portal/ParticipantChecklist.tsx`
- Test: `frontend/src/components/portal/__tests__/ActionBanner.test.tsx`
- Test: `frontend/src/components/portal/__tests__/ParticipantChecklist.test.tsx`

- [ ] **Step 1: ActionBanner.tsx 생성**

```typescript
import styled from '@emotion/styled';

export type BannerSeverity = 'warning' | 'danger' | 'info';

const COLORS: Record<BannerSeverity, string> = {
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',
};

const ICONS: Record<BannerSeverity, string> = {
  warning: '⚠',
  danger: '✕',
  info: 'ℹ',
};

const Banner = styled.div<{ severity: BannerSeverity }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: ${p => p.theme.radii.md};
  border: 1px solid ${p => COLORS[p.severity]}44;
  background: ${p => COLORS[p.severity]}10;
  margin-bottom: 10px;
`;

const Icon = styled.span`
  font-size: 14px;
  flex-shrink: 0;
`;

const TextGroup = styled.div`
  flex: 1;
`;

const Title = styled.div<{ severity: BannerSeverity }>`
  color: ${p => COLORS[p.severity]};
  font-size: 11px;
  font-weight: 700;
`;

const Desc = styled.div`
  color: ${p => p.theme.colors.sub};
  font-size: 10px;
  margin-top: 1px;
`;

const ActionBtn = styled.button<{ severity: BannerSeverity }>`
  background: ${p => COLORS[p.severity]}20;
  border: 1px solid ${p => COLORS[p.severity]}44;
  border-radius: ${p => p.theme.radii.xs};
  color: ${p => COLORS[p.severity]};
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
`;

export interface ActionBannerProps {
  severity: BannerSeverity;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function ActionBanner({ severity, title, description, action }: ActionBannerProps) {
  return (
    <Banner severity={severity}>
      <Icon>{ICONS[severity]}</Icon>
      <TextGroup>
        <Title severity={severity}>{title}</Title>
        <Desc>{description}</Desc>
      </TextGroup>
      {action && (
        <ActionBtn severity={severity} onClick={action.onClick}>
          {action.label}
        </ActionBtn>
      )}
    </Banner>
  );
}
```

- [ ] **Step 2: ParticipantChecklist.tsx 생성**

```typescript
import styled from '@emotion/styled';

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CheckCircle = styled.div<{ confirmed: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.confirmed ? p.theme.colors.success : 'transparent'};
  border: ${p => p.confirmed ? 'none' : `1.5px solid ${p.theme.colors.warning}`};
  font-size: 9px;
  font-weight: 700;
  color: ${p => p.confirmed ? '#fff' : p.theme.colors.warning};
`;

const Name = styled.span<{ roleColor?: string }>`
  font-size: 11px;
  color: ${p => p.roleColor ?? p.theme.colors.text};
  flex: 1;
`;

const ShareLabel = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
`;

const Summary = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid ${p => p.theme.colors.border};
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
`;

const SummaryCount = styled.span<{ allConfirmed: boolean }>`
  color: ${p => p.allConfirmed ? p.theme.colors.success : p.theme.colors.warning};
  font-weight: 700;
`;

export interface ChecklistEntry {
  name: string;
  shareBps: number;
  confirmed: boolean;
  roleColor?: string;
}

interface ParticipantChecklistProps {
  entries: ChecklistEntry[];
}

export function ParticipantChecklist({ entries }: ParticipantChecklistProps) {
  const confirmedCount = entries.filter(e => e.confirmed).length;
  const allConfirmed = confirmedCount === entries.length;

  return (
    <>
      <List>
        {entries.map((e, i) => (
          <Row key={i}>
            <CheckCircle confirmed={e.confirmed}>
              {e.confirmed ? '✓' : '…'}
            </CheckCircle>
            <Name roleColor={e.roleColor}>{e.name}</Name>
            <ShareLabel>{(e.shareBps / 100).toFixed(1)}%</ShareLabel>
          </Row>
        ))}
      </List>
      <Summary>
        <span>총 확정 지분</span>
        <SummaryCount allConfirmed={allConfirmed}>
          {confirmedCount}/{entries.length} 확정
        </SummaryCount>
      </Summary>
    </>
  );
}
```

- [ ] **Step 3: ActionBanner 테스트 작성**

`frontend/src/components/portal/__tests__/ActionBanner.test.tsx`:

```typescript
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
```

- [ ] **Step 4: ParticipantChecklist 테스트 작성**

`frontend/src/components/portal/__tests__/ParticipantChecklist.test.tsx`:

```typescript
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
  expect(screen.getByText('1/2 확정')).toBeInTheDocument();
});

test('전체 확정 시 요약 표시', () => {
  wrap(
    <ParticipantChecklist
      entries={[{ name: 'A', shareBps: 5000, confirmed: true }]}
    />,
  );
  expect(screen.getByText('1/1 확정')).toBeInTheDocument();
});
```

- [ ] **Step 5: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/portal/__tests__/
```
Expected: 6 tests PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/portal/
git commit -m "feat: ActionBanner, ParticipantChecklist 컴포넌트 추가"
```

---

## Task 4: PortalSidebar 컴포넌트

**Files:**
- Create: `frontend/src/components/layout/PortalSidebar.tsx`
- Test: `frontend/src/components/layout/__tests__/PortalSidebar.test.tsx`

- [ ] **Step 1: PortalSidebar.tsx 생성**

```typescript
import styled from '@emotion/styled';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
`;

const RoleBadge = styled.div<{ roleColor: string }>`
  background: ${p => p.roleColor}12;
  border: 1px solid ${p => p.roleColor}44;
  border-radius: ${p => p.theme.radii.md};
  padding: 10px;
`;

const RoleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
`;

const RoleDot = styled.div<{ color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${p => p.color};
  flex-shrink: 0;
`;

const RoleName = styled.span<{ color: string }>`
  color: ${p => p.color};
  font-size: 11px;
  font-weight: 700;
`;

const KpiItem = styled.div`
  & + & { margin-top: 8px; }
`;

const KpiLabel = styled.div`
  color: ${p => p.theme.colors.sub};
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const KpiValue = styled.div<{ color?: string }>`
  color: ${p => p.color ?? p.theme.colors.text};
  font-family: ${p => p.theme.fonts.mono};
  font-size: 15px;
  font-weight: 700;
  margin-top: 2px;
`;

const NavList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const NavItem = styled.button<{ active: boolean; roleColor: string }>`
  text-align: left;
  padding: 6px 9px;
  border-radius: ${p => p.theme.radii.sm};
  font-size: 11px;
  font-weight: ${p => (p.active ? 600 : 400)};
  color: ${p => (p.active ? p.roleColor : p.theme.colors.sub)};
  background: ${p => (p.active ? `${p.roleColor}15` : 'transparent')};
  border-left: ${p => (p.active ? `2px solid ${p.roleColor}` : '2px solid transparent')};
  border-top: none;
  border-right: none;
  border-bottom: none;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: ${p => p.roleColor};
    background: ${p => `${p.roleColor}10`};
  }
`;

export interface SidebarKpi {
  label: string;
  value: string;
  color?: string;
}

export interface NavTab {
  id: string;
  label: string;
}

interface PortalSidebarProps {
  roleName: string;
  roleColor: string;
  kpis: SidebarKpi[];
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function PortalSidebar({
  roleName,
  roleColor,
  kpis,
  tabs,
  activeTab,
  onTabChange,
}: PortalSidebarProps) {
  return (
    <Wrap>
      <RoleBadge roleColor={roleColor}>
        <RoleHeader>
          <RoleDot color={roleColor} />
          <RoleName color={roleColor}>{roleName}</RoleName>
        </RoleHeader>
        {kpis.map(kpi => (
          <KpiItem key={kpi.label}>
            <KpiLabel>{kpi.label}</KpiLabel>
            <KpiValue color={kpi.color}>{kpi.value}</KpiValue>
          </KpiItem>
        ))}
      </RoleBadge>

      <NavList>
        {tabs.map(tab => (
          <NavItem
            key={tab.id}
            active={activeTab === tab.id}
            roleColor={roleColor}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </NavItem>
        ))}
      </NavList>
    </Wrap>
  );
}
```

- [ ] **Step 2: 테스트 작성**

`frontend/src/components/layout/__tests__/PortalSidebar.test.tsx`:

```typescript
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
```

- [ ] **Step 3: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/layout/__tests__/PortalSidebar.test.tsx
```
Expected: 2 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/layout/PortalSidebar.tsx frontend/src/components/layout/__tests__/PortalSidebar.test.tsx
git commit -m "feat: PortalSidebar 컴포넌트 추가"
```

---

## Task 5: PortalHeader 수정 — 정책 선택기 + 테마 토글

**Files:**
- Modify: `frontend/src/components/layout/PortalHeader.tsx`

- [ ] **Step 1: PortalHeader.tsx 교체**

```typescript
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BaseHeader } from './BaseHeader';
import { Mono } from '@/components/common';
import { useThemeModeContext } from '@/context/ThemeModeContext';
import { useMyPolicies } from '@/hooks/useMyPolicies';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PolicySelect = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: ${p => p.theme.radii.sm};
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  max-width: 160px;
`;

const ThemeToggle = styled.button`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: ${p => p.theme.radii.pill};
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: ${p => p.theme.colors.sub};
  transition: all 0.2s;

  &:hover {
    border-color: ${p => p.theme.colors.primary};
  }
`;

const LangSelect = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: ${p => p.theme.radii.sm};
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
`;

const WalletWrap = styled.div`
  .wallet-adapter-button {
    height: 28px !important;
    padding: 0 12px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    font-family: ${p => p.theme.fonts.mono} !important;
    border-radius: 20px !important;
    background: ${p => p.theme.colors.card} !important;
    border: 1px solid ${p => p.theme.colors.border} !important;
    color: ${p => p.theme.colors.text} !important;
    line-height: 1 !important;
    transition: all 0.2s !important;
  }
  .wallet-adapter-button:hover {
    border-color: ${p => p.theme.colors.primary} !important;
    background: rgba(153,69,255,.08) !important;
  }
  .wallet-adapter-button-trigger {
    background: rgba(153,69,255,.15) !important;
    border-color: ${p => p.theme.colors.primary} !important;
    color: ${p => p.theme.colors.primary} !important;
  }
  .wallet-adapter-button > i,
  .wallet-adapter-button > img,
  .wallet-adapter-button-start-icon {
    width: 14px !important;
    height: 14px !important;
    margin-right: 5px !important;
  }
`;

const InfoBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 18px;
  margin: 0 -18px;
  border-top: 1px solid ${p => p.theme.colors.border};
`;

const RoleBadge = styled.div<{ roleColor: string }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: ${p => p.theme.radii.pill};
  border: 1px solid ${p => p.roleColor};
  background: ${p => p.roleColor}12;
  font-size: 11px;
  font-weight: 700;
  color: ${p => p.roleColor};
`;

const RoleDot = styled.div<{ color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.color};
`;

const PdaBadge = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: ${p => p.theme.radii.pill};
  border: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.surface2};
  font-size: 11px;
  color: ${p => p.theme.colors.sub};
`;

const ROLE_COLORS: Record<string, string> = {
  leader: '#9945FF',
  participant: '#22C55E',
  rein: '#38BDF8',
};

interface PortalHeaderProps {
  role: 'leader' | 'participant' | 'rein' | null;
  masterPDA: string | null;
  roles?: ParticipantInfo[];
}

export function PortalHeader({ role, masterPDA, roles }: PortalHeaderProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { mode, toggle } = useThemeModeContext();
  const { policies } = useMyPolicies();

  const displayRoles = roles && roles.length > 0 ? roles : role ? [{ role }] : [];

  const handlePolicyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      navigate('/portal');
      return;
    }
    const policy = policies.find(p => p.pda === val);
    if (policy?.track === 'B') {
      navigate(`/portal?trackb=${val}`);
    } else {
      navigate(`/portal?master=${val}`);
    }
  };

  const actions = (
    <Controls>
      {policies.length > 0 && (
        <PolicySelect value={masterPDA ?? ''} onChange={handlePolicyChange}>
          <option value="">{t('portal.selectPolicy')}</option>
          {policies.map(p => (
            <option key={p.pda} value={p.pda}>
              {p.track === 'B' ? `Policy #${p.masterId}` : `Master #${p.masterId}`}
            </option>
          ))}
        </PolicySelect>
      )}
      <ThemeToggle onClick={toggle} aria-label="테마 전환">
        {mode === 'dark' ? '☀️' : '🌙'}
      </ThemeToggle>
      <LangSelect value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
        <option value="en">EN</option>
        <option value="ko">KO</option>
      </LangSelect>
      <WalletWrap>
        <WalletMultiButton />
      </WalletWrap>
    </Controls>
  );

  const bottomBar = (
    <InfoBar>
      {displayRoles.map(r => {
        const color = r.role ? ROLE_COLORS[r.role] || '#94A3B8' : '#94A3B8';
        const label = r.role ? t(`portal.role.${r.role}`) : t('portal.noRole');
        return (
          <RoleBadge key={r.role} roleColor={color}>
            <RoleDot color={color} />
            {label}
          </RoleBadge>
        );
      })}
      {masterPDA && (
        <PdaBadge>
          <Mono style={{ fontSize: 9 }}>{masterPDA.slice(0, 8)}...{masterPDA.slice(-6)}</Mono>
        </PdaBadge>
      )}
    </InfoBar>
  );

  return <BaseHeader actions={actions} bottomBar={bottomBar} />;
}
```

- [ ] **Step 2: i18n 키 추가**

`frontend/src/i18n/locales/ko.ts` 의 portal 섹션에 추가:
```typescript
'portal.selectPolicy': '정책 선택',
```

`frontend/src/i18n/locales/en.ts` 의 portal 섹션에 추가:
```typescript
'portal.selectPolicy': 'Select Policy',
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/layout/PortalHeader.tsx frontend/src/i18n/locales/
git commit -m "feat: PortalHeader에 정책 선택기 + 테마 토글 추가"
```

---

## Task 6: LeaderPortal 페이지

**Files:**
- Create: `frontend/src/pages/portal/LeaderPortal.tsx`

- [ ] **Step 1: LeaderPortal.tsx 생성**

```typescript
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { ActionBanner } from '@/components/portal/ActionBanner';
import { ParticipantChecklist, type ChecklistEntry } from '@/components/portal/ParticipantChecklist';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalRiskDashboard } from '@/components/tabs/tab-portal/PortalRiskDashboard';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';
import { MasterPolicyStatus } from '@/lib/idl/open_parametric';

const ROLE_COLOR = '#9945FF';

const STATUS_LABELS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: 'Draft',
  [MasterPolicyStatus.PendingConfirm]: 'PendingConfirm',
  [MasterPolicyStatus.Active]: 'Active',
  [MasterPolicyStatus.Closed]: 'Closed',
  [MasterPolicyStatus.Cancelled]: 'Cancelled',
};

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'risk', label: 'Risk Dashboard' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'confirm', label: 'Confirm' },
];

interface LeaderPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
  onRefresh: () => void;
  allParticipants?: Array<{ name: string; shareBps: number; confirmed: boolean; roleColor?: string }>;
}

export function LeaderPortal({
  masterPDA,
  masterPDAStr,
  participantInfo,
  allRoles,
  onRefresh,
  allParticipants = [],
}: LeaderPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { poolBalance, totalPremium, totalClaim, policyStateIdx, contracts } = useProtocolStore();

  const poolHealth = poolBalance + totalClaim > 0
    ? Math.min(100, (poolBalance / (poolBalance + totalClaim)) * 100)
    : 100;
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const pendingClaims = contracts.filter(c => c.status === 'claimable').length;
  const unconfirmedCount = allParticipants.filter(p => !p.confirmed).length;

  const sidebarKpis: SidebarKpi[] = [
    { label: 'Pool Health', value: `${formatNum(poolHealth, 1)}%`, color: poolHealth > 80 ? '#22C55E' : '#F59E0B' },
    { label: 'Active Flights', value: String(activeCount), color: '#e2e8f0' },
    { label: 'Pending Claims', value: String(pendingClaims), color: pendingClaims > 0 ? '#F59E0B' : '#94A3B8' },
  ];

  const checklistEntries: ChecklistEntry[] = useMemo(() =>
    allParticipants.map(p => ({
      name: p.name,
      shareBps: p.shareBps,
      confirmed: p.confirmed,
      roleColor: p.roleColor,
    })),
    [allParticipants],
  );

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {unconfirmedCount > 0 && (
        <ActionBanner
          severity="warning"
          title={t('portal.leader.unconfirmedTitle', { count: unconfirmedCount })}
          description={t('portal.leader.unconfirmedDesc')}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Card style={{ borderTop: `2px solid ${ROLE_COLOR}` }}>
          <CardHeader><CardTitle>{t('portal.poolBalance')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              {formatNum(poolBalance, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #22C55E' }}>
          <CardHeader><CardTitle>{t('portal.totalPremium')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#22C55E' }}>
              {formatNum(totalPremium, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #EF4444' }}>
          <CardHeader><CardTitle>{t('portal.totalClaim')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
              {formatNum(totalClaim, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
      </div>

      {allParticipants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('portal.leader.participantStatus')}</CardTitle>
          </CardHeader>
          <CardBody>
            <ParticipantChecklist entries={checklistEntries} />
          </CardBody>
        </Card>
      )}
    </div>
  );

  return (
    <PortalShell
      header={<PortalHeader role="leader" masterPDA={masterPDAStr} roles={allRoles} />}
      sidebar={
        <PortalSidebar
          roleName={t('portal.role.leader')}
          roleColor={ROLE_COLOR}
          kpis={sidebarKpis}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'contracts' && <PortalContracts masterPDA={masterPDA} />}
      {activeTab === 'risk' && <PortalRiskDashboard participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'settlement' && <PortalSettlement participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'confirm' && (
        <PortalConfirm masterPDA={masterPDA} participantInfo={participantInfo} allRoles={allRoles} onSuccess={onRefresh} />
      )}
    </PortalShell>
  );
}
```

- [ ] **Step 2: i18n 키 추가**

`ko.ts` portal 섹션에 추가:
```typescript
'portal.leader.unconfirmedTitle': '{{count}}명 미확정',
'portal.leader.unconfirmedDesc': '정책 활성화를 위해 미확정 참여사에게 확정을 요청하세요.',
'portal.leader.participantStatus': '참여사 현황',
'portal.totalClaim': '누적 클레임',
```

`en.ts` portal 섹션에 추가:
```typescript
'portal.leader.unconfirmedTitle': '{{count}} Unconfirmed',
'portal.leader.unconfirmedDesc': 'Request confirmation from pending participants to activate the policy.',
'portal.leader.participantStatus': 'Participant Status',
'portal.totalClaim': 'Total Claims',
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/portal/LeaderPortal.tsx frontend/src/i18n/locales/
git commit -m "feat: LeaderPortal 페이지 추가"
```

---

## Task 7: ParticipantPortal 페이지

**Files:**
- Create: `frontend/src/pages/portal/ParticipantPortal.tsx`

- [ ] **Step 1: ParticipantPortal.tsx 생성**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { ActionBanner } from '@/components/portal/ActionBanner';
import { Card, CardHeader, CardTitle, CardBody, FormGroup, FormLabel, FormInput, Button } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ROLE_COLOR = '#22C55E';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'settlement', label: 'Settlement' },
];

interface ParticipantPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
  onRefresh: () => void;
  poolBalance?: number;
  onFund?: (amount: number) => Promise<void>;
}

export function ParticipantPortal({
  masterPDA,
  masterPDAStr,
  participantInfo,
  allRoles,
  onRefresh,
  poolBalance = 0,
  onFund,
}: ParticipantPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [fundAmount, setFundAmount] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const { totalPremium, totalClaim } = useProtocolStore();

  const shareBps = participantInfo.shareBps;
  const myPremium = totalPremium * (shareBps / 10000);
  const myLiability = totalClaim * (shareBps / 10000);

  const sidebarKpis: SidebarKpi[] = [
    { label: 'My Share', value: `${(shareBps / 100).toFixed(1)}%`, color: ROLE_COLOR },
    { label: 'My Pool', value: `$${formatNum(poolBalance, 2)}`, color: '#e2e8f0' },
    { label: 'Status', value: participantInfo.confirmed ? '확정' : '대기중', color: participantInfo.confirmed ? '#22C55E' : '#F59E0B' },
  ];

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0 || !onFund) return;
    setFundLoading(true);
    try {
      await onFund(amount);
      setFundAmount('');
    } finally {
      setFundLoading(false);
    }
  };

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!participantInfo.confirmed && (
        <ActionBanner
          severity="warning"
          title={t('portal.participant.unconfirmedTitle')}
          description={t('portal.participant.unconfirmedDesc')}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Card style={{ borderTop: `2px solid ${ROLE_COLOR}` }}>
          <CardHeader><CardTitle>{t('portal.myShare')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: ROLE_COLOR }}>
              {(shareBps / 100).toFixed(1)}%
            </div>
            <KVRow label="bps" value={String(shareBps)} />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #22C55E' }}>
          <CardHeader><CardTitle>{t('portal.myPremium')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#22C55E' }}>
              {formatNum(myPremium, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #EF4444' }}>
          <CardHeader><CardTitle>{t('portal.myClaim')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
              {formatNum(myLiability, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
      </div>

      {onFund && (
        <Card>
          <CardHeader><CardTitle>{t('portal.fundMyPool')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel>{t('portal.fundAmount')}</FormLabel>
                <FormInput
                  type="number"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </FormGroup>
              <Button
                variant="primary"
                onClick={handleFund}
                disabled={fundLoading || !fundAmount}
                style={{ whiteSpace: 'nowrap', marginBottom: 0 }}
              >
                {fundLoading ? t('portal.funding') : t('portal.fundBtn')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  return (
    <PortalShell
      header={<PortalHeader role="participant" masterPDA={masterPDAStr} roles={allRoles} />}
      sidebar={
        <PortalSidebar
          roleName={t('portal.role.participant')}
          roleColor={ROLE_COLOR}
          kpis={sidebarKpis}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'contracts' && <PortalContracts masterPDA={masterPDA} />}
      {activeTab === 'confirm' && (
        <PortalConfirm masterPDA={masterPDA} participantInfo={participantInfo} allRoles={allRoles} onSuccess={onRefresh} />
      )}
      {activeTab === 'settlement' && <PortalSettlement participantInfo={participantInfo} allRoles={allRoles} />}
    </PortalShell>
  );
}
```

- [ ] **Step 2: i18n 키 추가**

`ko.ts`:
```typescript
'portal.participant.unconfirmedTitle': '확정 필요',
'portal.participant.unconfirmedDesc': '계약 조건을 확인하고 확정 탭에서 서명하세요.',
```

`en.ts`:
```typescript
'portal.participant.unconfirmedTitle': 'Confirmation Required',
'portal.participant.unconfirmedDesc': 'Review contract terms and sign in the Confirm tab.',
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/portal/ParticipantPortal.tsx frontend/src/i18n/locales/
git commit -m "feat: ParticipantPortal 페이지 추가"
```

---

## Task 8: ReinPortal 페이지

**Files:**
- Create: `frontend/src/pages/portal/ReinPortal.tsx`

- [ ] **Step 1: ReinPortal.tsx 생성**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { ActionBanner } from '@/components/portal/ActionBanner';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';
import { PortalRiskDashboard } from '@/components/tabs/tab-portal/PortalRiskDashboard';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ROLE_COLOR = '#38BDF8';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'risk', label: 'Risk Dashboard' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'confirm', label: 'Confirm' },
];

interface ReinPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
  onRefresh: () => void;
}

export function ReinPortal({
  masterPDA,
  masterPDAStr,
  participantInfo,
  allRoles,
  onRefresh,
}: ReinPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { poolBalance, cededRatioBps, reinsCommissionBps, contracts, payoutTiers } = useProtocolStore();

  const cededPct = (cededRatioBps / 100).toFixed(1);
  const commissionPct = (reinsCommissionBps / 100).toFixed(1);
  const riskExposure = poolBalance * (cededRatioBps / 10000);
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const maxExposure = payoutTiers.delay6hOrCancelled * activeCount * (cededRatioBps / 10000);

  const sidebarKpis: SidebarKpi[] = [
    { label: 'Ceded Ratio', value: `${cededPct}%`, color: ROLE_COLOR },
    { label: 'Commission', value: `${commissionPct}%`, color: '#e2e8f0' },
    { label: 'Max Exposure', value: `$${formatNum(maxExposure, 0)}`, color: '#EF4444' },
  ];

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!participantInfo.confirmed && (
        <ActionBanner
          severity="warning"
          title={t('portal.rein.unconfirmedTitle')}
          description={t('portal.rein.unconfirmedDesc')}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Card style={{ borderTop: `2px solid ${ROLE_COLOR}` }}>
          <CardHeader><CardTitle>{t('portal.cededRatio')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: ROLE_COLOR }}>
              {cededPct}%
            </div>
            <KVRow label="bps" value={String(cededRatioBps)} />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #14F195' }}>
          <CardHeader><CardTitle>{t('portal.commissionRate')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#14F195' }}>
              {commissionPct}%
            </div>
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #EF4444' }}>
          <CardHeader><CardTitle>{t('portal.maxExposure')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
              {formatNum(maxExposure, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('portal.riskExposure')}</CardTitle></CardHeader>
        <CardBody>
          <KVRow label={t('portal.poolBalance')} value={`${formatNum(poolBalance, 2)} USDC`} />
          <KVRow label={t('portal.activeContracts')} value={String(activeCount)} />
          <KVRow label={t('portal.riskExposure')} value={`${formatNum(riskExposure, 2)} USDC`} />
        </CardBody>
      </Card>
    </div>
  );

  return (
    <PortalShell
      header={<PortalHeader role="rein" masterPDA={masterPDAStr} roles={allRoles} />}
      sidebar={
        <PortalSidebar
          roleName={t('portal.role.rein')}
          roleColor={ROLE_COLOR}
          kpis={sidebarKpis}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'risk' && <PortalRiskDashboard participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'settlement' && <PortalSettlement participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'confirm' && (
        <PortalConfirm masterPDA={masterPDA} participantInfo={participantInfo} allRoles={allRoles} onSuccess={onRefresh} />
      )}
    </PortalShell>
  );
}
```

- [ ] **Step 2: i18n 키 추가**

`ko.ts`:
```typescript
'portal.rein.unconfirmedTitle': '재보험 확정 필요',
'portal.rein.unconfirmedDesc': '재보험 조건을 확인하고 확정 탭에서 서명하세요.',
```

`en.ts`:
```typescript
'portal.rein.unconfirmedTitle': 'Reinsurance Confirmation Required',
'portal.rein.unconfirmedDesc': 'Review reinsurance terms and sign in the Confirm tab.',
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/portal/ReinPortal.tsx frontend/src/i18n/locales/
git commit -m "feat: ReinPortal 페이지 추가"
```

---

## Task 9: OperatorPortal 페이지

**Files:**
- Create: `frontend/src/pages/portal/OperatorPortal.tsx`

- [ ] **Step 1: OperatorPortal.tsx 생성**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { useProtocolStore } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';

const ROLE_COLOR = '#94A3B8';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
];

interface OperatorPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
}

export function OperatorPortal({ masterPDA, masterPDAStr, participantInfo, allRoles }: OperatorPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { contracts, poolBalance } = useProtocolStore();

  const activeCount = contracts.filter(c => c.status === 'active').length;
  const totalCount = contracts.length;

  const sidebarKpis: SidebarKpi[] = [
    { label: 'Total Contracts', value: String(totalCount) },
    { label: 'Active', value: String(activeCount), color: '#22C55E' },
  ];

  const overviewContent = (
    <Card>
      <CardHeader><CardTitle>{t('portal.operator.overview')}</CardTitle></CardHeader>
      <CardBody>
        <KVRow label={t('portal.activeContracts')} value={String(activeCount)} />
        <KVRow label={t('portal.poolBalance')} value={`${poolBalance.toFixed(2)} USDC`} />
      </CardBody>
    </Card>
  );

  return (
    <PortalShell
      header={<PortalHeader role={null} masterPDA={masterPDAStr} roles={allRoles} />}
      sidebar={
        <PortalSidebar
          roleName={t('portal.role.operator')}
          roleColor={ROLE_COLOR}
          kpis={sidebarKpis}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'contracts' && <PortalContracts masterPDA={masterPDA} />}
    </PortalShell>
  );
}
```

- [ ] **Step 2: i18n 키 추가**

`ko.ts`:
```typescript
'portal.operator.overview': '운영 현황',
```
`en.ts`:
```typescript
'portal.operator.overview': 'Operator Overview',
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/portal/OperatorPortal.tsx frontend/src/i18n/locales/
git commit -m "feat: OperatorPortal 페이지 추가"
```

---

## Task 10: PortalPage 라우터 리팩터

**Files:**
- Modify: `frontend/src/pages/PortalPage.tsx`

- [ ] **Step 1: PortalPage.tsx 교체 — 역할 분기 라우터로 단순화**

```typescript
import { useMemo } from 'react';
import styled from '@emotion/styled';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/layout/PageShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { Tag, Mono, Card } from '@/components/common';
import { useParticipantRole } from '@/hooks/useParticipantRole';
import { useMyPolicies, type MyPolicySummary } from '@/hooks/useMyPolicies';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { POLICY_STATE_LABELS, PolicyState, MasterPolicyStatus } from '@/lib/idl/open_parametric';
import { LeaderPortal } from './portal/LeaderPortal';
import { ParticipantPortal } from './portal/ParticipantPortal';
import { ReinPortal } from './portal/ReinPortal';
import { OperatorPortal } from './portal/OperatorPortal';

const CenterBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  color: ${p => p.theme.colors.sub};
  font-size: 13px;
  text-align: center;
`;

const ErrorBox = styled.div`
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid ${p => p.theme.colors.danger};
  background: rgba(239,68,68,.06);
  color: ${p => p.theme.colors.danger};
  font-size: 11px;
  margin: 20px auto;
  max-width: 500px;
  text-align: center;
`;

const PolicyListWrap = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
`;

const PolicyListTitle = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
  margin-bottom: 16px;
  text-align: center;
`;

const PolicyCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.surface1};
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    border-color: ${p => p.theme.colors.primary};
    background: ${p => p.theme.colors.surface2};
  }
`;

const ROLE_COLORS: Record<string, string> = {
  leader: '#9945FF',
  partA: '#22C55E',
  partB: '#F59E0B',
  rein: '#38BDF8',
};

const STATUS_LABELS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: 'Draft',
  [MasterPolicyStatus.PendingConfirm]: 'Pending',
  [MasterPolicyStatus.Active]: 'Active',
  [MasterPolicyStatus.Closed]: 'Closed',
  [MasterPolicyStatus.Cancelled]: 'Cancelled',
};

const STATUS_COLORS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: '#94A3B8',
  [MasterPolicyStatus.PendingConfirm]: '#F59E0B',
  [MasterPolicyStatus.Active]: '#22C55E',
  [MasterPolicyStatus.Closed]: '#64748B',
  [MasterPolicyStatus.Cancelled]: '#EF4444',
};

const TRACK_B_STATUS_COLORS: Record<number, string> = {
  [PolicyState.Draft]: '#94A3B8',
  [PolicyState.Open]: '#38BDF8',
  [PolicyState.Funded]: '#F59E0B',
  [PolicyState.Active]: '#22C55E',
  [PolicyState.Claimable]: '#EF4444',
  [PolicyState.Approved]: '#9945FF',
  [PolicyState.Settled]: '#64748B',
  [PolicyState.Expired]: '#475569',
};

function PolicyListItem({ policy, onClick }: { policy: MyPolicySummary; onClick: () => void }) {
  const { t } = useTranslation();
  const isTrackB = policy.track === 'B';
  const statusColor = isTrackB
    ? (TRACK_B_STATUS_COLORS[policy.status] || '#94A3B8')
    : (STATUS_COLORS[policy.status] || '#94A3B8');
  const statusLabel = isTrackB
    ? (POLICY_STATE_LABELS[policy.status] || 'Unknown')
    : (STATUS_LABELS[policy.status] || 'Unknown');

  return (
    <PolicyCard onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {policy.roles.map(r => (
          <Tag key={r.role} variant="subtle" style={{ color: ROLE_COLORS[r.role] || '#94A3B8', fontSize: 9, minWidth: 48, textAlign: 'center' }}>
            {t(`portal.role.${r.role}`, r.role)}
          </Tag>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
            {isTrackB ? `Policy #${policy.masterId}` : `Master #${policy.masterId}`}
          </span>
          <Mono style={{ fontSize: 9, color: 'var(--sub)' }}>
            {isTrackB && policy.flightNo
              ? `${policy.flightNo} · ${policy.route}`
              : `${policy.pda.slice(0, 12)}...${policy.pda.slice(-8)}`}
          </Mono>
        </div>
      </div>
      <Tag variant="subtle" style={{ color: statusColor, fontSize: 8 }}>{statusLabel}</Tag>
    </PolicyCard>
  );
}

export function PortalPage() {
  const { t } = useTranslation();
  const { publicKey, connected } = useWallet();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { policies, loading: policiesLoading } = useMyPolicies();

  const masterParam = searchParams.get('master');
  const masterPDA = useMemo(() => {
    if (!masterParam) return null;
    try { return new PublicKey(masterParam); }
    catch { return null; }
  }, [masterParam]);

  const { info: participantInfo, roles, loading, error, refresh: refreshRole } = useParticipantRole(masterPDA);
  const primaryRole = roles[0]?.role ?? null;

  // Not connected
  if (!connected || !publicKey) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={null} />}>
        <CenterBox>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
          <div>{t('portal.connectWallet')}</div>
          <WalletMultiButton />
        </CenterBox>
      </PageShell>
    );
  }

  // No master PDA — policy list
  if (!masterPDA) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={null} />}>
        <PolicyListWrap>
          <PolicyListTitle>{t('portal.myPolicies')}</PolicyListTitle>
          {policiesLoading ? (
            <CenterBox style={{ minHeight: '30vh' }}><div>{t('portal.loadingPolicies')}</div></CenterBox>
          ) : policies.length === 0 ? (
            <CenterBox style={{ minHeight: '30vh' }}>
              <div style={{ fontSize: 32 }}>📋</div>
              <div>{t('portal.noPolicies')}</div>
            </CenterBox>
          ) : (
            policies.map(p => (
              <PolicyListItem
                key={p.pda}
                policy={p}
                onClick={() => navigate(
                  p.track === 'B' ? `/portal?trackb=${p.pda}` : `/portal?master=${p.pda}`,
                )}
              />
            ))
          )}
        </PolicyListWrap>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <CenterBox><div>{t('portal.detectingRole')}</div></CenterBox>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <ErrorBox>{error}</ErrorBox>
      </PageShell>
    );
  }

  if (!participantInfo || roles.length === 0) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <CenterBox>
          <div style={{ fontSize: 32 }}>🚫</div>
          <div>{t('portal.noPermission')}</div>
        </CenterBox>
      </PageShell>
    );
  }

  // 역할별 페이지 분기
  if (primaryRole === 'leader') {
    return (
      <LeaderPortal
        masterPDA={masterPDA}
        masterPDAStr={masterParam!}
        participantInfo={participantInfo}
        allRoles={roles}
        onRefresh={refreshRole}
      />
    );
  }

  if (primaryRole === 'rein') {
    return (
      <ReinPortal
        masterPDA={masterPDA}
        masterPDAStr={masterParam!}
        participantInfo={participantInfo}
        allRoles={roles}
        onRefresh={refreshRole}
      />
    );
  }

  if (primaryRole === 'participant') {
    return (
      <ParticipantPortal
        masterPDA={masterPDA}
        masterPDAStr={masterParam!}
        participantInfo={participantInfo}
        allRoles={roles}
        onRefresh={refreshRole}
      />
    );
  }

  // operator fallback
  return (
    <OperatorPortal
      masterPDA={masterPDA}
      masterPDAStr={masterParam!}
      participantInfo={participantInfo}
      allRoles={roles}
    />
  );
}
```

- [ ] **Step 2: 타입 체크 + 빌드 확인**

```bash
cd frontend && npm run build 2>&1 | tail -30
```
Expected: 오류 없이 빌드 완료

- [ ] **Step 3: 전체 테스트 실행**

```bash
cd frontend && npm test -- --run 2>&1 | tail -20
```
Expected: 모든 기존 테스트 PASS + 신규 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/PortalPage.tsx frontend/src/pages/portal/
git commit -m "feat: PortalPage 역할별 분기 라우터로 리팩터"
```

---

## 미결 사항

- `LeaderPortal`에 전달하는 `allParticipants` 데이터는 `useParticipantRole` 훅이 백엔드에서 반환하는 전체 participants 배열로 채워야 함. 현재 훅은 내 지갑의 역할만 반환하므로, 리더 전용으로 전체 participants 목록을 가져오는 로직 추가 필요 (별도 태스크 또는 기존 fetch 확장).
- Pool 잔액 부족 ActionBanner 트리거 기준값 — 백엔드/기획 확인 후 추가.
