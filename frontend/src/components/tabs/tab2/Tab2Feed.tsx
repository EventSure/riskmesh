import styled from '@emotion/styled';
import { ContractForm } from './ContractForm';
import { AccumulatedSummary } from './AccumulatedSummary';
import { PremiumPieChart } from './PremiumPieChart';
import { ContractFeedTable } from './ContractFeedTable';
import { PremiumLineChart } from './PremiumLineChart';

const Col = styled.div`
  overflow-y: auto;
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 12px;
  &:last-child { border-right: none; }
`;
const ColSm = styled(Col)`flex: 0 0 272px;`;
const ColLg = styled(Col)`flex: 1;`;

export function Tab2Feed() {
  return (
    <>
      <ColSm>
        <ContractForm />
        <AccumulatedSummary />
        <PremiumPieChart />
      </ColSm>
      <ColLg>
        <ContractFeedTable />
        <PremiumLineChart />
      </ColLg>
    </>
  );
}
