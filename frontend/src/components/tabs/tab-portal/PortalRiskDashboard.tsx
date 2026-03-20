import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Mono } from '@/components/common';
import { KVRow } from './KVRow';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const BigValue = styled(Mono)`
  font-size: 20px;
  font-weight: 700;
  display: block;
  margin: 4px 0;
`;

interface PortalRiskDashboardProps {
  participantInfo: ParticipantInfo;
  allRoles?: ParticipantInfo[];
}

export function PortalRiskDashboard({ participantInfo, allRoles }: PortalRiskDashboardProps) {
  const { t } = useTranslation();
  const { poolBalance, totalPremium, contracts, cededRatioBps, reinsCommissionBps, payoutTiers } = useProtocolStore();

  const roles = allRoles && allRoles.length > 0 ? allRoles : [participantInfo];
  // Use rein-specific info if available, otherwise fall back to primary
  const reinInfo = roles.find(r => r.role === 'rein') ?? participantInfo;

  const cededPct = (cededRatioBps / 100).toFixed(1);
  const commissionPct = (reinsCommissionBps / 100).toFixed(1);
  const riskExposure = poolBalance * (cededRatioBps / 10000);
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const maxPayoutPerPolicy = payoutTiers.delay6hOrCancelled;
  const maxExposure = maxPayoutPerPolicy * activeCount * (cededRatioBps / 10000);
  const commissionIncome = totalPremium * (reinsCommissionBps / 10000);
  const reinSharePct = (reinInfo.shareBps / 100).toFixed(1);

  return (
    <div style={{ padding: 14 }}>
      <Grid>
        <Card>
          <CardHeader>
            <CardTitle>{t('portal.cededRatio')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--info)' }}>{cededPct}%</BigValue>
            <KVRow label={t('portal.cededBps')} value={`${cededRatioBps} bps`} />
            <KVRow label={t('portal.reinShare')} value={`${reinSharePct}% (${reinInfo.shareBps} bps)`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.commissionRate')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--accent)' }}>{commissionPct}%</BigValue>
            <KVRow label={t('portal.commissionIncome')} value={formatNum(commissionIncome, 2) + ' USDC'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.riskExposure')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--warning)' }}>{formatNum(riskExposure, 2)} USDC</BigValue>
            <KVRow label={t('portal.poolBalance')} value={formatNum(poolBalance, 2) + ' USDC'} />
            <KVRow label={t('portal.activeContracts')} value={String(activeCount)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.maxExposure')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--danger)' }}>{formatNum(maxExposure, 2)} USDC</BigValue>
            <KVRow label={t('portal.maxTier')} value={formatNum(maxPayoutPerPolicy, 2) + ' USDC'} />
            <KVRow label={t('portal.activeContracts')} value={String(activeCount)} />
          </CardBody>
        </Card>
      </Grid>
    </div>
  );
}
