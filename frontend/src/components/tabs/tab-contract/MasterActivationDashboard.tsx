import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button, Card, CardBody, CardHeader, CardTitle, Tag } from '@/components/common';
import { PoolHealthVisual } from '@/components/tabs/shared/PoolHealthVisual';
import { useMasterAgreementActivation } from '@/hooks/useMasterAgreementActivation';
import { useMasterAgreementSnapshot } from '@/hooks/useMasterAgreementSnapshot';
import { formatNum, useProtocolStore } from '@/store/useProtocolStore';

const DashboardStack = styled.div`
  display: grid;
  gap: 16px;
`;

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
`;

const KpiCard = styled.div`
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card2);
  display: grid;
  gap: 6px;
`;

const KpiLabel = styled.span`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sub);
`;

const KpiValue = styled.span<{ tone?: 'default' | 'danger' | 'accent' | 'sub' }>`
  font-family: 'DM Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  color: ${({ tone }) => {
    if (tone === 'danger') return 'var(--danger)';
    if (tone === 'accent') return 'var(--accent)';
    if (tone === 'sub') return 'var(--sub)';
    return 'var(--text)';
  }};
`;

const AgreementName = styled.p`
  margin: 0 0 14px;
  color: var(--text);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const EmptyState = styled.div`
  padding: 16px;
  border-radius: 12px;
  border: 1px dashed var(--border);
  color: var(--sub);
  font-size: 13px;
  text-align: center;
`;

const BlockerNote = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
`;

const MoneyStack = styled.div`
  display: grid;
  gap: 10px;
`;

const MoneyRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.42);
`;

const MoneyLabel = styled.span`
  color: var(--sub);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const MoneyValue = styled.span<{ tone?: 'default' | 'danger' | 'accent' }>`
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  color: ${({ tone }) => {
    if (tone === 'danger') return 'var(--danger)';
    if (tone === 'accent') return 'var(--accent)';
    return 'var(--text)';
  }};
`;

const ActionStack = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 16px;
`;

function formatUsdc(value: number | null | undefined): string {
  return value == null ? '—' : `${formatNum(value, 2)} USDC`;
}

export function MasterActivationDashboard() {
  const { t } = useTranslation();
  const { masterAgreementPDA, masterActive, selectedMasterAgreementName } = useProtocolStore(useShallow((state) => ({
    masterAgreementPDA: state.masterAgreementPDA,
    masterActive: state.masterActive,
    selectedMasterAgreementName: state.selectedMasterAgreementName,
  })));
  const masterAgreementKey = useMemo(
    () => (masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null),
    [masterAgreementPDA],
  );
  const { snapshot, status, activePartyId, masterData, loading, error, policyStatus, policyError } = useMasterAgreementSnapshot(masterAgreementKey);
  const { activateLoading, canActivate, handleActivate } = useMasterAgreementActivation();
  const readinessLoading = loading || (!!masterData && !snapshot && !error);

  const agreementName =
    snapshot?.agreementName ||
    selectedMasterAgreementName?.trim() ||
    masterData?.name?.trim() ||
    t('master.noNameFallback');
  const readinessTag = readinessLoading
    ? t('master.loading')
    : !snapshot
      ? t('master.step3.empty')
    : snapshot?.aggregateReady
      ? t('pool.healthAggregateReady')
      : t('pool.healthAggregateActionNeeded');
  const readinessVariant = readinessLoading || !snapshot ? 'subtle' : snapshot.aggregateReady ? 'accent' : 'warning';
  const emptyMessage = readinessLoading ? t('master.loading') : error || t('master.step3.empty');
  const moneyMessage = policyStatus === 'loading'
    ? t('master.loading')
    : policyStatus === 'error'
      ? policyError || t('master.step3.empty')
      : emptyMessage;
  const showMoneySnapshot = policyStatus === 'ready' && !!snapshot;

  return (
    <DashboardStack data-testid="master-activation-dashboard">
      <Card>
        <CardHeader>
          <CardTitle>{t('master.step.activate')}</CardTitle>
          <Tag variant={readinessVariant}>{readinessTag}</Tag>
        </CardHeader>
        <CardBody>
          <AgreementName>{agreementName}</AgreementName>
          <KpiGrid>
            <KpiCard>
              <KpiLabel>{t('master.step3.totalRequired')}</KpiLabel>
              <KpiValue>{formatUsdc(snapshot?.totalRequired)}</KpiValue>
            </KpiCard>
            <KpiCard>
              <KpiLabel>{t('master.step3.totalFunded')}</KpiLabel>
              <KpiValue tone={snapshot?.totalDeficit ? 'sub' : 'accent'}>{formatUsdc(snapshot?.totalFunded)}</KpiValue>
            </KpiCard>
            <KpiCard>
              <KpiLabel>{t('master.step3.totalDeficit')}</KpiLabel>
              <KpiValue tone={snapshot?.totalDeficit ? 'danger' : 'accent'}>
                {formatUsdc(snapshot?.totalDeficit)}
              </KpiValue>
            </KpiCard>
            <KpiCard>
              <KpiLabel>{t('pool.healthTotal')}</KpiLabel>
              <KpiValue tone={snapshot?.aggregateReady ? 'accent' : 'default'}>
                {snapshot ? `${formatNum(snapshot.readinessPct, 1)}%` : '—'}
              </KpiValue>
            </KpiCard>
          </KpiGrid>

          {snapshot && !readinessLoading && snapshot.blockerLabels.length ? (
            <BlockerNote>
              {t('pool.healthAggregateActionNeeded')}: {snapshot.blockerLabels.join(', ')}
            </BlockerNote>
          ) : null}

          {!snapshot && <BlockerNote>{emptyMessage}</BlockerNote>}

          {!masterActive && (
            <ActionStack>
              <Button
                variant="accent"
                fullWidth
                onClick={() => void handleActivate()}
                disabled={!canActivate || activateLoading}
                data-testid="master-activation-cta"
                data-guide="activate-btn"
              >
                {activateLoading ? 'Sending TX...' : t('confirm.activateBtn')}
              </Button>
            </ActionStack>
          )}
        </CardBody>
      </Card>

      {status ? (
        <PoolHealthVisual title={t('pool.healthTitle')} status={status} activePartyId={activePartyId} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('pool.healthTitle')}</CardTitle>
          </CardHeader>
          <CardBody>
            <EmptyState>{emptyMessage}</EmptyState>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('master.step3.moneyTitle')}</CardTitle>
        </CardHeader>
        <CardBody>
          {showMoneySnapshot ? (
            <MoneyStack>
              <MoneyRow>
                <MoneyLabel>{t('master.step3.totalPremiumInflow')}</MoneyLabel>
                <MoneyValue tone="accent">{formatUsdc(snapshot.totalPremiumInflow)}</MoneyValue>
              </MoneyRow>
              <MoneyRow>
                <MoneyLabel>{t('master.step3.totalClaimOutflow')}</MoneyLabel>
                <MoneyValue tone="danger">{formatUsdc(snapshot.totalClaimOutflow)}</MoneyValue>
              </MoneyRow>
              <MoneyRow>
                <MoneyLabel>{t('master.step3.netBalance')}</MoneyLabel>
                <MoneyValue tone={snapshot.netBalance >= 0 ? 'accent' : 'danger'}>
                  {formatUsdc(snapshot.netBalance)}
                </MoneyValue>
              </MoneyRow>
            </MoneyStack>
          ) : (
            <EmptyState>{moneyMessage}</EmptyState>
          )}
        </CardBody>
      </Card>
    </DashboardStack>
  );
}
