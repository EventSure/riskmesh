import { OracleStepPanel } from './OracleStepPanel';
import { PolicyMonitorTable } from './PolicyMonitorTable';
import { ClaimTable } from './ClaimTable';
import { ClaimSettlementSummary } from './ClaimSettlementSummary';
import { ContentArea } from '@/components/common/StepPanel';

export function TabOracle() {
  return (
    <>
      <OracleStepPanel />
      <ContentArea>
        <PolicyMonitorTable />
        <ClaimTable />
        <ClaimSettlementSummary />
      </ContentArea>
    </>
  );
}
