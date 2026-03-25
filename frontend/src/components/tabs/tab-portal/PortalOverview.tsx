import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Mono, Tag } from '@/components/common';
import { KVRow } from './KVRow';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';
import { MasterPolicyStatus } from '@/lib/idl/open_parametric';

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

const STATUS_LABELS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: 'Draft',
  [MasterPolicyStatus.PendingConfirm]: 'PendingConfirm',
  [MasterPolicyStatus.Active]: 'Active',
  [MasterPolicyStatus.Closed]: 'Closed',
  [MasterPolicyStatus.Cancelled]: 'Cancelled',
};

const STATUS_COLORS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: '#94A3B8',
  [MasterPolicyStatus.PendingConfirm]: '#F59E0B',
  [MasterPolicyStatus.Active]: '#22C55E',
  [MasterPolicyStatus.Closed]: '#64748B',
  [MasterPolicyStatus.Cancelled]: '#EF4444',
};

interface PortalOverviewProps {
  participantInfo: ParticipantInfo;
  allRoles?: ParticipantInfo[];
}

export function PortalOverview({ participantInfo, allRoles }: PortalOverviewProps) {
  const { t } = useTranslation();
  const { policyStateIdx, poolBalance, totalPremium, totalClaim } = useProtocolStore();

  const roles = allRoles && allRoles.length > 0 ? allRoles : [participantInfo];
  // Sum shareBps across participant roles only (partA/partB/rein) — leader 10000 is not additive
  const participantRoles = roles.filter(r => r.role !== 'leader');
  const effectiveRoles = participantRoles.length > 0 ? participantRoles : roles;
  const totalShareBps = effectiveRoles.reduce((sum, r) => sum + r.shareBps, 0);
  const totalSharePct = (totalShareBps / 100).toFixed(1);
  const myPremium = totalPremium * (totalShareBps / 10000);
  const myClaim = totalClaim * (totalShareBps / 10000);
  const poolHealth = poolBalance + totalClaim > 0
    ? Math.min(100, (poolBalance / (poolBalance + totalClaim)) * 100)
    : 100;

  return (
    <div style={{ padding: 14 }}>
      <Grid>
        <Card>
          <CardHeader>
            <CardTitle>{t('portal.policyStatus')}</CardTitle>
            <Tag variant="subtle" style={{ color: STATUS_COLORS[policyStateIdx] || '#94A3B8' }}>
              {STATUS_LABELS[policyStateIdx] || 'Unknown'}
            </Tag>
          </CardHeader>
          <CardBody>
            <KVRow label={t('portal.poolBalance')} value={formatNum(poolBalance, 2) + ' USDC'} />
            <KVRow label={t('portal.poolHealth')} value={formatNum(poolHealth, 1) + '%'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.myShare')}</CardTitle>
            <Tag variant="accent">{totalSharePct}%</Tag>
          </CardHeader>
          <CardBody>
            <BigValue>{totalSharePct}%</BigValue>
            {roles.map(r => (
              <KVRow
                key={r.role}
                label={t(`portal.role.${r.role}`, r.role ?? '—')}
                value={`${(r.shareBps / 100).toFixed(1)}% (${r.shareBps} bps) · ${r.confirmed ? t('portal.confirmed') : t('portal.pendingConfirm')}`}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.myPremium')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--success)' }}>{formatNum(myPremium, 2)} USDC</BigValue>
            <KVRow label={t('portal.totalPremium')} value={formatNum(totalPremium, 2) + ' USDC'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.myClaim')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--danger)' }}>{formatNum(myClaim, 2)} USDC</BigValue>
            <KVRow label={t('portal.totalClaim')} value={formatNum(totalClaim, 2) + ' USDC'} />
          </CardBody>
        </Card>
      </Grid>
    </div>
  );
}
