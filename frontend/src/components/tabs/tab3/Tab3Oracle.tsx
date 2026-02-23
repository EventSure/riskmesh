import styled from '@emotion/styled';
import { OracleConsole } from './OracleConsole';
import { ClaimApproval } from './ClaimApproval';
import { ClaimTable } from './ClaimTable';
import { ClaimSettlementSummary } from './ClaimSettlementSummary';

const Col = styled.div`
  overflow-y: auto;
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 12px;
  &:last-child { border-right: none; }
`;
const ColSm = styled(Col)`flex: 0 0 272px;`;
const ColLg = styled(Col)`flex: 1;`;

export function Tab3Oracle() {
  return (
    <>
      <ColSm>
        <OracleConsole />
        <ClaimApproval />
      </ColSm>
      <ColLg>
        <ClaimTable />
        <ClaimSettlementSummary />
      </ColLg>
    </>
  );
}
