import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import {
  ActionPanel, PanelHeader, PanelTitle, PanelStatusBadge, StepsScroll,
} from '@/components/common/StepPanel';
import { ContractForm } from './ContractForm';
import { AccumulatedSummary } from './AccumulatedSummary';

export function FeedStepPanel() {
  const { t } = useTranslation();
  const { claimCount } = useProtocolStore(useShallow(s => ({
    claimCount: s.claimCount,
  })));

  return (
    <ActionPanel>
      <PanelHeader>
        <PanelTitle>{t('tab.feed')}</PanelTitle>
        <PanelStatusBadge variant={claimCount > 0 ? 'accent' : 'warning'}>
          {claimCount}건 발행
        </PanelStatusBadge>
      </PanelHeader>
      <StepsScroll>
        <ContractForm />
        <AccumulatedSummary />
      </StepsScroll>
    </ActionPanel>
  );
}
