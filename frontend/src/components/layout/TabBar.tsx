import styled from '@emotion/styled';

const TabsWrap = styled.div`
  display: flex;
  background: ${p => p.theme.colors.card2};
  border-bottom: 1px solid ${p => p.theme.colors.border};
`;

const Tab = styled.div<{ active?: boolean }>`
  padding: 9px 16px;
  font-size: 11px;
  font-weight: 600;
  color: ${p => (p.active ? p.theme.colors.primary : p.theme.colors.sub)};
  cursor: pointer;
  border-bottom: 2px solid ${p => (p.active ? p.theme.colors.primary : 'transparent')};
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.colors.primary};
  }
`;

export const TAB_IDS = ['t1', 't2', 't3', 't4', 't5'] as const;
export type TabId = (typeof TAB_IDS)[number];

const TAB_LABELS: Record<TabId, string> = {
  t1: '📋 계약 체결',
  t2: '⚡ 실시간 계약 피드',
  t3: '🔮 오라클 & 클레임',
  t4: '💰 정산 현황',
  t5: '🔍 On-chain Inspector',
};

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <TabsWrap>
      {TAB_IDS.map(id => (
        <Tab key={id} active={activeTab === id} onClick={() => onTabChange(id)}>
          {TAB_LABELS[id]}
        </Tab>
      ))}
    </TabsWrap>
  );
}
