import { FeedStepPanel } from './FeedStepPanel';
import { ContractFeedTable } from './ContractFeedTable';
import { PremiumLineChart } from './PremiumLineChart';
import { PremiumPieChart } from './PremiumPieChart';
import { ContentArea } from '@/components/common/StepPanel';

export function TabFeed() {
  return (
    <>
      <FeedStepPanel />
      <ContentArea>
        <ContractFeedTable />
        <PremiumLineChart />
        <PremiumPieChart />
      </ContentArea>
    </>
  );
}
