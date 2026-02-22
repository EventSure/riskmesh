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

export function Dashboard() {
  return (
    <>
      <div className="main">
        {/* LEFT COL: Policy Builder + Details */}
        <div className="col">
          <PolicyBuilder />
          <PolicyDetails />
          <ClaimCard />
          <ExternalRefs />
        </div>

        {/* CENTER COL: State Machine + Demo Runner + Oracle */}
        <div className="col" style={{ borderRight: '1px solid var(--border)' }}>
          <StateMachine />
          <InstructionRunner />
          <OracleConsole />
          <RiskTokenToggle />
        </div>

        {/* RIGHT COL: Underwriting Pool */}
        <div className="col">
          <RiskPoolAccount />
          <Participants />
          <VaultChart />
          <OnChainInspector />
        </div>
      </div>

      <EventLog />
    </>
  );
}
