import styled from '@emotion/styled';
import { MasterContractSetup } from './MasterContractSetup';
import { ShareStructure } from './ShareStructure';
import { ContractProcess } from './ContractProcess';
import { ParticipantConfirm } from './ParticipantConfirm';
import { SettlementFlow } from './SettlementFlow';
import { StateMachine } from './StateMachine';
import { PoolStatus } from './PoolStatus';
import { EventLog } from './EventLog';

const Col = styled.div`
  overflow-y: auto;
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 12px;
  &:last-child { border-right: none; }
`;

const ColSm = styled(Col)`flex: 0 0 272px;`;
const ColMd = styled(Col)`flex: 0 0 326px;`;
const ColLg = styled(Col)`flex: 1;`;

export function TabContract() {
  return (
    <>
      <ColSm>
        <MasterContractSetup />
        <ShareStructure />
      </ColSm>
      <ColMd>
        <ContractProcess />
        <ParticipantConfirm />
        <SettlementFlow />
      </ColMd>
      <ColLg>
        <StateMachine />
        <PoolStatus />
        <EventLog />
      </ColLg>
    </>
  );
}
