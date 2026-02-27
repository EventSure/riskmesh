import { useState } from 'react';
import styled from '@emotion/styled';
import { TabBar, type TabId } from '@/components/layout/TabBar';
import { TabContract } from '@/components/tabs/tab-contract/TabContract';
import { TabFeed } from '@/components/tabs/tab-feed/TabFeed';
import { TabOracle } from '@/components/tabs/tab-oracle/TabOracle';
import { TabSettlement } from '@/components/tabs/tab-settlement/TabSettlement';
import { TabInspector } from '@/components/tabs/tab-inspector/TabInspector';
import { GuideTour } from '@/components/guide/GuideTour';

const TabContent = styled.div<{ visible: boolean }>`
  display: ${p => (p.visible ? 'flex' : 'none')};
  height: calc(100vh - 136px);
  overflow: hidden;
`;

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('tab-contract');

  return (
    <>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TabContent visible={activeTab === 'tab-contract'}><TabContract /></TabContent>
      <TabContent visible={activeTab === 'tab-feed'}><TabFeed /></TabContent>
      <TabContent visible={activeTab === 'tab-oracle'}><TabOracle /></TabContent>
      <TabContent visible={activeTab === 'tab-settlement'}><TabSettlement /></TabContent>
      <TabContent visible={activeTab === 'tab-inspector'}><TabInspector /></TabContent>
      <GuideTour activeTab={activeTab} />
    </>
  );
}
