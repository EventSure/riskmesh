import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { ActionBanner } from '@/components/portal/ActionBanner';
import { ParticipantChecklist, type ChecklistEntry } from '@/components/portal/ParticipantChecklist';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalRiskDashboard } from '@/components/tabs/tab-portal/PortalRiskDashboard';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ROLE_COLOR = '#9945FF';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'risk', label: 'Risk Dashboard' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'confirm', label: 'Confirm' },
];

interface LeaderPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
  onRefresh: () => void;
  allParticipants?: Array<{ name: string; shareBps: number; confirmed: boolean; roleColor?: string }>;
}

export function LeaderPortal({
  masterPDA,
  masterPDAStr,
  participantInfo,
  allRoles,
  onRefresh,
  allParticipants = [],
}: LeaderPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { poolBalance, totalPremium, totalClaim, contracts } = useProtocolStore();

  const poolHealth = poolBalance + totalClaim > 0
    ? Math.min(100, (poolBalance / (poolBalance + totalClaim)) * 100)
    : 100;
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const pendingClaims = contracts.filter(c => c.status === 'claimed').length;
  const unconfirmedCount = allParticipants.filter(p => !p.confirmed).length;

  const sidebarKpis: SidebarKpi[] = [
    { label: t('portal.sidebar.poolHealth'), value: `${formatNum(poolHealth, 1)}%`, color: poolHealth > 80 ? '#22C55E' : '#F59E0B' },
    { label: t('portal.sidebar.activeFlights'), value: String(activeCount), color: '#e2e8f0' },
    { label: t('portal.sidebar.pendingClaims'), value: String(pendingClaims), color: pendingClaims > 0 ? '#F59E0B' : '#94A3B8' },
  ];

  const checklistEntries: ChecklistEntry[] = useMemo(() =>
    allParticipants.map(p => ({
      name: p.name,
      shareBps: p.shareBps,
      confirmed: p.confirmed,
      roleColor: p.roleColor,
    })),
    [allParticipants],
  );

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {unconfirmedCount > 0 && (
        <ActionBanner
          severity="warning"
          title={t('portal.leader.unconfirmedTitle', { count: unconfirmedCount })}
          description={t('portal.leader.unconfirmedDesc')}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Card style={{ borderTop: `2px solid ${ROLE_COLOR}` }}>
          <CardHeader><CardTitle>{t('portal.poolBalance')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700 }}>
              {formatNum(poolBalance, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #22C55E' }}>
          <CardHeader><CardTitle>{t('portal.totalPremium')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#22C55E' }}>
              {formatNum(totalPremium, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #EF4444' }}>
          <CardHeader><CardTitle>{t('portal.totalClaim')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
              {formatNum(totalClaim, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
      </div>
      {allParticipants.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t('portal.leader.participantStatus')}</CardTitle></CardHeader>
          <CardBody>
            <ParticipantChecklist entries={checklistEntries} />
          </CardBody>
        </Card>
      )}
    </div>
  );

  return (
    <PortalShell
      header={<PortalHeader role="leader" masterPDA={masterPDAStr} roles={allRoles} hideBottomBar />}
      sidebar={
        <PortalSidebar
          portalTitle={t('portal.leaderPortalTitle')}
          roleName={t('portal.role.leader')}
          roleColor={ROLE_COLOR}
          kpis={sidebarKpis}
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'contracts' && <PortalContracts masterPDA={masterPDA} />}
      {activeTab === 'risk' && <PortalRiskDashboard participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'settlement' && <PortalSettlement participantInfo={participantInfo} allRoles={allRoles} />}
      {activeTab === 'confirm' && (
        <PortalConfirm masterPDA={masterPDA} participantInfo={participantInfo} allRoles={allRoles} onSuccess={onRefresh} />
      )}
    </PortalShell>
  );
}
