import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import {
  ActionPanel, PanelHeader, PanelTitle, PanelStatusBadge, StepsScroll,
} from '@/components/common/StepPanel';
import { OracleConsole } from './OracleConsole';
import { ClaimApproval } from './ClaimApproval';

export function OracleStepPanel() {
  const { t } = useTranslation();
  const { claimCount } = useProtocolStore(useShallow(s => ({
    claimCount: s.claimCount,
  })));

  return (
    <ActionPanel>
      <PanelHeader>
        <PanelTitle>{t('tab.oracle')}</PanelTitle>
        {claimCount > 0 && (
          <PanelStatusBadge variant="warning">{t('oracle.pendingClaims', { count: claimCount })}</PanelStatusBadge>
        )}
      </PanelHeader>
      <StepsScroll>
        <OracleConsole />
        <ClaimApproval />
      </StepsScroll>
    </ActionPanel>
  );
}
