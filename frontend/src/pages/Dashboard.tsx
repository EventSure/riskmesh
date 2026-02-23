import styled from '@emotion/styled';
import { PolicyBuilder } from '@/components/dashboard/PolicyBuilder';
import { PolicyDetails } from '@/components/dashboard/PolicyDetails';
import { ClaimCard } from '@/components/dashboard/ClaimCard';
import { ExternalRefs } from '@/components/dashboard/ExternalRefs';
import { StateMachine } from '@/components/dashboard/StateMachine';
import { InstructionRunner } from '@/components/dashboard/InstructionRunner';
import { OracleConsole } from '@/components/dashboard/OracleConsole';
import { RiskTokenToggle } from '@/components/dashboard/RiskTokenToggle';
import { RiskPoolAccount } from '@/components/dashboard/RiskPoolAccount';
import { Participants } from '@/components/dashboard/Participants';
import { VaultChart } from '@/components/dashboard/VaultChart';
import { OnChainInspector } from '@/components/dashboard/OnChainInspector';
import { EventLog } from '@/components/dashboard/EventLog';

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr 300px;
  gap: 0;
  height: calc(100vh - 106px);
  min-height: 600px;
`;

const Column = styled.div`
  overflow-y: auto;
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 14px;
  &:last-child {
    border-right: none;
  }
`;

export function Dashboard() {
  return (
    <>
      <MainGrid>
        {/* LEFT COL: Policy Builder + Details */}
        <Column>
          <PolicyBuilder />
          <PolicyDetails />
          <ClaimCard />
          <ExternalRefs />
        </Column>

        {/* CENTER COL: State Machine + Demo Runner + Oracle */}
        <Column>
          <StateMachine />
          <InstructionRunner />
          <OracleConsole />
          <RiskTokenToggle />
        </Column>

        {/* RIGHT COL: Underwriting Pool */}
        <Column>
          <RiskPoolAccount />
          <Participants />
          <VaultChart />
          <OnChainInspector />
        </Column>
      </MainGrid>

      <EventLog />
    </>
  );
}
