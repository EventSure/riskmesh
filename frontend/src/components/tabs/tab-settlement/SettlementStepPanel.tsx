import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import {
  ActionPanel, PanelHeader, PanelTitle, PanelStatusBadge, StepsScroll,
} from '@/components/common/StepPanel';
import { ComparisonPanel } from './ComparisonPanel';

export function SettlementStepPanel() {
  const { t } = useTranslation();
  const { claimCount, totalClaim, totalPremium } = useProtocolStore(useShallow(s => ({
    claimCount: s.claimCount,
    totalClaim: s.totalClaim,
    totalPremium: s.totalPremium,
  })));

  const netLabel = totalPremium > 0
    ? `P ${totalPremium.toFixed(0)} / C ${totalClaim.toFixed(0)}`
    : t('common.pending');

  return (
    <ActionPanel>
      <PanelHeader>
        <PanelTitle>{t('tab.settlement')}</PanelTitle>
        <PanelStatusBadge variant={claimCount > 0 ? 'warning' : 'accent'}>
          {netLabel}
        </PanelStatusBadge>
      </PanelHeader>
      <StepsScroll>
        <ComparisonPanel />
      </StepsScroll>
    </ActionPanel>
  );
}
