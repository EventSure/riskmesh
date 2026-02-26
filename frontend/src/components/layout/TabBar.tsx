import styled from '@emotion/styled';

const TabsWrap = styled.div`
  display: flex;
  background: ${p => p.theme.colors.card2};
  border-bottom: 1px solid ${p => p.theme.colors.border};
`;

const Tab = styled.button<{ active?: boolean }>`
  padding: 9px 16px;
  font-size: 11px;
  font-weight: 600;
  color: ${p => (p.active ? p.theme.colors.primary : p.theme.colors.sub)};
  cursor: pointer;
  border: none;
  border-bottom: 2px solid ${p => (p.active ? p.theme.colors.primary : 'transparent')};
  background: none;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.colors.primary};
  }
`;

export const TAB_IDS = ['tab-contract', 'tab-feed', 'tab-oracle', 'tab-settlement', 'tab-inspector'] as const;
export type TabId = (typeof TAB_IDS)[number];

const TAB_LABELS: Record<TabId, string> = {
  'tab-contract': '📋 계약 체결',
  'tab-feed': '⚡ 실시간 계약 피드',
  'tab-oracle': '🔮 오라클 & 클레임',
  'tab-settlement': '💰 정산 현황',
  'tab-inspector': '🔍 On-chain Inspector',
};

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <TabsWrap role="tablist">
      {TAB_IDS.map(id => (
        <Tab
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          tabIndex={activeTab === id ? 0 : -1}
          active={activeTab === id}
          onClick={() => onTabChange(id)}
        >
          {TAB_LABELS[id]}
        </Tab>
      ))}
    </TabsWrap>
  );
}
