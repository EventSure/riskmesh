import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { TabId } from './TabBar';
import { useProtocolStore } from '@/store/useProtocolStore';

const Sidebar = styled.nav`
  width: 200px;
  flex-shrink: 0;
  background: ${p => p.theme.colors.card2};
  border-right: 1px solid ${p => p.theme.colors.border};
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  overflow: hidden;
`;

const RoleArea = styled.div`
  padding: 0 16px 14px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  margin-bottom: 8px;
`;

const RoleName = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${p => p.theme.colors.primary};
`;

const RoleSub = styled.div`
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  margin-top: 1px;
`;

const SectionLabel = styled.div`
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #374151;
  padding: 10px 16px 5px;
`;

const NavItem = styled.button<{ active?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border: none;
  border-left: 2px solid ${p => (p.active ? p.theme.colors.primary : 'transparent')};
  background: ${p => (p.active ? `rgba(153,69,255,0.06)` : 'transparent')};
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;

  &:hover {
    background: ${p => p.theme.colors.surface1};
  }
`;

const NavLabel = styled.span<{ active?: boolean }>`
  font-size: 11px;
  font-weight: 600;
  color: ${p => (p.active ? p.theme.colors.primary : p.theme.colors.sub)};
`;

const NavBadge = styled.span<{ variant: 'danger' | 'warning' }>`
  font-size: 8px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: ${p =>
    p.variant === 'danger'
      ? 'rgba(239,68,68,0.12)'
      : 'rgba(245,158,11,0.12)'};
  color: ${p =>
    p.variant === 'danger' ? p.theme.colors.danger : p.theme.colors.warning};
`;

const Divider = styled.div`
  height: 1px;
  background: ${p => p.theme.colors.border};
  margin: 8px 16px;
`;

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const MENU_TABS: { id: TabId; labelKey: string }[] = [
  { id: 'tab-contract', labelKey: 'tab.contract' },
  { id: 'tab-feed', labelKey: 'tab.feed' },
  { id: 'tab-oracle', labelKey: 'tab.oracle' },
  { id: 'tab-settlement', labelKey: 'tab.settlement' },
];

const TOOL_TABS: { id: TabId; labelKey: string }[] = [
  { id: 'tab-inspector', labelKey: 'tab.inspector' },
];

export function DashboardSidebar({ activeTab, onTabChange }: Props) {
  const { t } = useTranslation();
  const { claimCount, mode } = useProtocolStore(useShallow(s => ({
    claimCount: s.claimCount,
    mode: s.mode,
  })));

  return (
    <Sidebar>
      <RoleArea>
        <RoleName>Admin</RoleName>
        <RoleSub>{mode === 'simulation' ? '시뮬레이션 모드' : '온체인 모드'}</RoleSub>
      </RoleArea>

      <SectionLabel>메뉴</SectionLabel>
      {MENU_TABS.map(({ id, labelKey }) => (
        <NavItem
          key={id}
          active={activeTab === id}
          onClick={() => onTabChange(id)}
          data-guide={id}
        >
          <NavLabel active={activeTab === id}>{t(labelKey)}</NavLabel>
          {id === 'tab-oracle' && claimCount > 0 && (
            <NavBadge variant="danger">{claimCount}</NavBadge>
          )}
        </NavItem>
      ))}

      <Divider />

      <SectionLabel>도구</SectionLabel>
      {TOOL_TABS.map(({ id, labelKey }) => (
        <NavItem
          key={id}
          active={activeTab === id}
          onClick={() => onTabChange(id)}
          data-guide={id}
        >
          <NavLabel active={activeTab === id}>{t(labelKey)}</NavLabel>
        </NavItem>
      ))}
    </Sidebar>
  );
}
