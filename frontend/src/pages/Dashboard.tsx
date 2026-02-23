import { useState } from 'react';
import styled from '@emotion/styled';
import { TabBar, type TabId } from '@/components/layout/TabBar';
import { Tab1Contract } from '@/components/tabs/tab1/Tab1Contract';
import { Tab2Feed } from '@/components/tabs/tab2/Tab2Feed';
import { Tab3Oracle } from '@/components/tabs/tab3/Tab3Oracle';
import { Tab4Settlement } from '@/components/tabs/tab4/Tab4Settlement';
import { Tab5Inspector } from '@/components/tabs/tab5/Tab5Inspector';

const TabContent = styled.div<{ visible: boolean }>`
  display: ${p => (p.visible ? 'flex' : 'none')};
  height: calc(100vh - 136px);
  overflow: hidden;
`;

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('t1');

  return (
    <>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TabContent visible={activeTab === 't1'}><Tab1Contract /></TabContent>
      <TabContent visible={activeTab === 't2'}><Tab2Feed /></TabContent>
      <TabContent visible={activeTab === 't3'}><Tab3Oracle /></TabContent>
      <TabContent visible={activeTab === 't4'}><Tab4Settlement /></TabContent>
      <TabContent visible={activeTab === 't5'}><Tab5Inspector /></TabContent>
    </>
  );
}
