import { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import type { TabId } from '@/components/layout/TabBar';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { TabContract } from '@/components/tabs/tab-contract/TabContract';
import { TabFeed } from '@/components/tabs/tab-feed/TabFeed';
import { TabOracle } from '@/components/tabs/tab-oracle/TabOracle';
import { TabSettlement } from '@/components/tabs/tab-settlement/TabSettlement';
import { TabInspector } from '@/components/tabs/tab-inspector/TabInspector';
import { GuideTour } from '@/components/guide/GuideTour';
import { useProtocolStore } from '@/store/useProtocolStore';

const DashboardRoot = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  /* min-height: 0 — column 부모(DashboardRoot)의 main축에서 컨텐츠보다 작게 줄어들 수 있도록.
     없으면 본인이 자식 컨텐츠의 내재 높이만큼 늘어 ActionPanel/StepsScroll의 높이 제약이 풀린다. */
  min-height: 0;
  overflow: hidden;
`;

const TabContent = styled.div<{ visible: boolean }>`
  display: ${p => (p.visible ? 'flex' : 'none')};
  flex: 1;
  /* TabContent는 row flex 컨테이너이지만 자체도 row(Body)의 자식. cross축(높이)은 Body 높이로 결정.
     Body의 min-height:0 만으로 충분하지만 안전하게 자체에도 부여. */
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('tab-contract');
  const captureKpiSnapshot = useProtocolStore(s => s.captureKpiSnapshot);

  useEffect(() => {
    captureKpiSnapshot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DashboardRoot>
      <Body>
        <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <TabContent visible={activeTab === 'tab-contract'}><TabContract /></TabContent>
        <TabContent visible={activeTab === 'tab-feed'}><TabFeed /></TabContent>
        <TabContent visible={activeTab === 'tab-oracle'}><TabOracle /></TabContent>
        <TabContent visible={activeTab === 'tab-settlement'}><TabSettlement /></TabContent>
        <TabContent visible={activeTab === 'tab-inspector'}><TabInspector /></TabContent>
      </Body>
      <GuideTour activeTab={activeTab} setActiveTab={setActiveTab} />
    </DashboardRoot>
  );
}
