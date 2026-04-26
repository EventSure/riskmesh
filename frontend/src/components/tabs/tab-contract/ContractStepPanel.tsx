import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import {
  ActionPanel, PanelHeader, PanelTitle, PanelStatusBadge,
  StepProgressBar, StepsScroll, StepCard, type StepDef,
} from '@/components/common/StepPanel';
import { MasterContractSetup } from './MasterContractSetup';
import { ParticipantConfirm } from './ParticipantConfirm';
import { SettlementFlow } from './SettlementFlow';

export function ContractStepPanel() {
  const { t } = useTranslation();
  const { processStep, masterActive } = useProtocolStore(useShallow(s => ({
    processStep: s.processStep,
    masterActive: s.masterActive,
  })));

  const step1Status: StepDef['status'] = processStep >= 1 ? 'done' : 'active';
  const step2Status: StepDef['status'] =
    processStep < 1 ? 'locked' : processStep >= 3 ? 'done' : 'active';
  const step3Status: StepDef['status'] =
    processStep < 3 ? 'locked' : masterActive ? 'done' : 'active';

  const steps: StepDef[] = [
    { label: '기본설정', status: step1Status },
    { label: '참여사', status: step2Status },
    { label: '활성화', status: step3Status },
  ];

  const statusLabel = masterActive ? t('common.active') : t('common.inactive');
  const statusVariant = masterActive ? 'accent' : 'warning';

  return (
    <ActionPanel>
      <PanelHeader>
        <PanelTitle>{t('master.title')}</PanelTitle>
        <PanelStatusBadge variant={statusVariant}>{statusLabel}</PanelStatusBadge>
      </PanelHeader>
      <StepProgressBar steps={steps} />
      <StepsScroll>
        <StepCard index={0} title={t('master.step.basic')} status={step1Status}>
          <MasterContractSetup />
        </StepCard>
        <StepCard index={1} title={t('master.step.participants')} status={step2Status}>
          <ParticipantConfirm />
        </StepCard>
        <StepCard index={2} title={t('master.step.activate')} status={step3Status}>
          <SettlementFlow />
        </StepCard>
      </StepsScroll>
    </ActionPanel>
  );
}
