import styled from '@emotion/styled';
import { SettlementStepPanel } from './SettlementStepPanel';
import { PendingClaimsTable } from './PendingClaimsTable';
import { PremiumSettlementTable } from './PremiumSettlementTable';
import { ClaimSettlementTable } from './ClaimSettlementTable';
import { FinalSettlementTable } from './FinalSettlementTable';
import { SettlementChart } from './SettlementChart';
import { ContentArea } from '@/components/common/StepPanel';

const SettlementContentArea = styled(ContentArea)`
  padding-bottom: 64px;

  > * {
    flex-shrink: 0;
  }
`;

export function TabSettlement() {
  return (
    <>
      <SettlementStepPanel />
      <SettlementContentArea>
        <PendingClaimsTable />
        <PremiumSettlementTable />
        <ClaimSettlementTable />
        <FinalSettlementTable />
        <SettlementChart />
      </SettlementContentArea>
    </>
  );
}
