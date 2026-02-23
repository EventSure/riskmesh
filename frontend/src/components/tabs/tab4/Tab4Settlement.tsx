import styled from '@emotion/styled';
import { PremiumSettlementTable } from './PremiumSettlementTable';
import { ClaimSettlementTable } from './ClaimSettlementTable';
import { FinalSettlementTable } from './FinalSettlementTable';
import { SettlementChart } from './SettlementChart';
import { ComparisonPanel } from './ComparisonPanel';

const Col = styled.div`
  overflow-y: auto;
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 12px;
  &:last-child { border-right: none; }
`;
const ColMain = styled(Col)`flex: 1;`;
const ColSide = styled(Col)`flex: 0 0 272px;`;

export function Tab4Settlement() {
  return (
    <>
      <ColMain>
        <PremiumSettlementTable />
        <ClaimSettlementTable />
        <FinalSettlementTable />
        <SettlementChart />
      </ColMain>
      <ColSide>
        <ComparisonPanel />
      </ColSide>
    </>
  );
}
