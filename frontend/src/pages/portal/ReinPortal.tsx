import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { ActionBanner } from '@/components/portal/ActionBanner';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';
import { PortalRiskDashboard } from '@/components/tabs/tab-portal/PortalRiskDashboard';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ROLE_COLOR = '#38BDF8';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'risk', label: 'Risk Dashboard' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'confirm', label: 'Confirm' },
];

interface ReinPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
  onRefresh: () => void;
}

export function ReinPortal({ masterPDA, masterPDAStr, participantInfo, allRoles, onRefresh }: ReinPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { poolBalance, cededRatioBps, reinsCommissionBps, contracts, payoutTiers } = useProtocolStore();

  const cededPct = (cededRatioBps / 100).toFixed(1);
  const commissionPct = (reinsCommissionBps / 100).toFixed(1);
  const riskExposure = poolBalance * (cededRatioBps / 10000);
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const maxExposure = payoutTiers.delay6hOrCancelled * activeCount * (cededRatioBps / 10000);

  const sidebarKpis: SidebarKpi[] = [
    { label: t('portal.sidebar.cededRatio'), value: `${cededPct}%`, color: ROLE_COLOR },
    { label: t('portal.sidebar.commission'), value: `${commissionPct}%`, color: '#e2e8f0' },
    { label: t('portal.sidebar.maxExposure'), value: `$${formatNum(maxExposure, 0)}`, color: '#EF4444' },
  ];

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!participantInfo.confirmed && (
        <ActionBanner
          severity="warning"
          title={t('portal.rein.unconfirmedTitle')}
          description={t('portal.rein.unconfirmedDesc')}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Card style={{ borderTop: `2px solid ${ROLE_COLOR}` }}>
          <CardHeader><CardTitle>{t('portal.cededRatio')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: ROLE_COLOR }}>
              {cededPct}%
            </div>
            <KVRow label="bps" value={String(cededRatioBps)} />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #14F195' }}>
          <CardHeader><CardTitle>{t('portal.commissionRate')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#14F195' }}>
              {commissionPct}%
            </div>
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #EF4444' }}>
          <CardHeader><CardTitle>{t('portal.maxExposure')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
              {formatNum(maxExposure, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('portal.riskExposure')}</CardTitle></CardHeader>
        <CardBody>
          <KVRow label={t('portal.poolBalance')} value={`${formatNum(poolBalance, 2)} USDC`} />
          <KVRow label={t('portal.activeContracts')} value={String(activeCount)} />
          <KVRow label={t('portal.riskExposure')} value={`${formatNum(riskExposure, 2)} USDC`} />
        </CardBody>
      </Card>
    </div>
  );

  return (
    <PortalShell
      header={<PortalHeader role="rein" masterPDA={masterPDAStr} roles={allRoles} hideBottomBar />}
      sidebar={
        <PortalSidebar
          roleName={t('portal.role.rein')}
          roleColor={ROLE_COLOR}
          kpis={sidebarKpis}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'risk' && <PortalRiskDashboard participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'settlement' && <PortalSettlement participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'confirm' && (
        <PortalConfirm masterPDA={masterPDA} participantInfo={participantInfo} allRoles={allRoles} onSuccess={onRefresh} />
      )}
    </PortalShell>
  );
}
