import styled from '@emotion/styled';
import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Card, CardBody, CardHeader, CardTitle, Tag } from '@/components/common';
import { useMasterAgreementAccount } from '@/hooks/useMasterAgreementAccount';
import { formatNum, useProtocolStore } from '@/store/useProtocolStore';

export type MasterAgreementReviewStep = 'basic' | 'participants' | 'activate';

const SummaryStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.42);
`;

const SummaryLabel = styled.div`
  min-width: 0;
  color: var(--sub);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const SummaryValue = styled.div`
  min-width: 0;
  text-align: right;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
`;

const MonoValue = styled(SummaryValue)`
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  word-break: break-all;
`;

function getNextAction({
  selectedStep,
  processStep,
  reinsurerEnabled,
  reinsurerConfirmed,
  masterActive,
}: {
  selectedStep: MasterAgreementReviewStep;
  processStep: number;
  reinsurerEnabled: boolean;
  reinsurerConfirmed: boolean;
  masterActive: boolean;
}) {
  if (masterActive || processStep >= 5) {
    return 'master.review.next.active';
  }

  if (processStep < 1 || (selectedStep === 'basic' && processStep === 0)) {
    return 'master.review.next.setTerms';
  }

  if (processStep < 4 || (reinsurerEnabled && !reinsurerConfirmed)) {
    return 'master.review.next.confirmParticipants';
  }

  return 'master.review.next.activate';
}

export function MasterAgreementReviewPanel({ selectedStep }: { selectedStep: MasterAgreementReviewStep }) {
  const { t } = useTranslation();
  const {
    mode,
    coverageStart,
    coverageEnd,
    premiumPerPolicy,
    payoutTiers,
    leaderShare,
    participants,
    reinsurer,
    processStep,
    masterActive,
    masterAgreementPDA,
    selectedMasterAgreementName,
  } = useProtocolStore(useShallow(state => ({
    mode: state.mode,
    coverageStart: state.coverageStart,
    coverageEnd: state.coverageEnd,
    premiumPerPolicy: state.premiumPerPolicy,
    payoutTiers: state.payoutTiers,
    leaderShare: state.leaderShare,
    participants: state.participants,
    reinsurer: state.reinsurer,
    processStep: state.processStep,
    masterActive: state.masterActive,
    masterAgreementPDA: state.masterAgreementPDA,
    selectedMasterAgreementName: state.selectedMasterAgreementName,
  })));

  const shareTotal = leaderShare + participants.reduce((sum, participant) => sum + participant.share, 0);
  const confirmationsTotal = participants.length + (reinsurer.enabled ? 1 : 0);
  const confirmationsDone =
    participants.filter(participant => participant.confirmed).length +
    (reinsurer.enabled && reinsurer.confirmed ? 1 : 0);
  const missingWallets =
    participants.filter(participant => !participant.address.trim()).length +
    (reinsurer.enabled && !reinsurer.address.trim() ? 1 : 0);
  const walletStatus =
    missingWallets === 0
      ? t('master.review.walletsReady')
      : t('master.review.walletsMissing', { count: missingWallets });
  const nextActionKey = getNextAction({
    selectedStep,
    processStep,
    reinsurerEnabled: reinsurer.enabled,
    reinsurerConfirmed: reinsurer.confirmed,
    masterActive,
  });
  const masterAgreementKey = useMemo(
    () => (masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null),
    [masterAgreementPDA],
  );
  const { account } = useMasterAgreementAccount(masterAgreementKey);

  return (
    <Card data-testid="master-agreement-review-panel">
      <CardHeader>
        <CardTitle>{t('master.review.title')}</CardTitle>
        <Tag variant={masterActive ? 'accent' : 'warning'}>
          {masterActive ? t('common.active') : t('common.inProgress')}
        </Tag>
      </CardHeader>
      <CardBody>
        <SummaryStack>
          <SummaryRow>
            <SummaryLabel>{t('master.review.name')}</SummaryLabel>
            <SummaryValue>{selectedMasterAgreementName?.trim() || account?.name?.trim() || t('master.noNameFallback')}</SummaryValue>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>{t('master.review.coverage')}</SummaryLabel>
            <SummaryValue>{`${coverageStart} - ${coverageEnd}`}</SummaryValue>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>{t('master.review.premium')}</SummaryLabel>
            <SummaryValue>{`${formatNum(premiumPerPolicy, 2)} USDC`}</SummaryValue>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>{t('master.review.maxPayout')}</SummaryLabel>
            <SummaryValue>{`${formatNum(payoutTiers.delay6hOrCancelled, 2)} USDC`}</SummaryValue>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>{t('master.review.shareTotal')}</SummaryLabel>
            <SummaryValue>{`${formatNum(shareTotal, 0)}%`}</SummaryValue>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>{t('master.review.confirmations')}</SummaryLabel>
            <SummaryValue>{`${confirmationsDone}/${confirmationsTotal}`}</SummaryValue>
          </SummaryRow>

          {mode === 'onchain' && (
            <SummaryRow>
              <SummaryLabel>{t('master.review.wallets')}</SummaryLabel>
              <SummaryValue>{walletStatus}</SummaryValue>
            </SummaryRow>
          )}

          <SummaryRow>
            <SummaryLabel>{t('master.review.pda')}</SummaryLabel>
            <MonoValue>{masterAgreementPDA ?? t('master.review.noPda')}</MonoValue>
          </SummaryRow>

          <SummaryRow>
            <SummaryLabel>{t('master.review.nextAction')}</SummaryLabel>
            <SummaryValue>{t(nextActionKey)}</SummaryValue>
          </SummaryRow>
        </SummaryStack>
      </CardBody>
    </Card>
  );
}
