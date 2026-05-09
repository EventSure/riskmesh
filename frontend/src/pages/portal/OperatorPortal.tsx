import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { useProtocolStore } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';

const ROLE_COLOR = '#94A3B8';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
];

interface OperatorPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
}

export function OperatorPortal({ masterPDA, masterPDAStr, allRoles }: OperatorPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const { contracts, poolBalance } = useProtocolStore();

  const activeCount = contracts.filter(c => c.status === 'active').length;
  const totalCount = contracts.length;

  const sidebarKpis: SidebarKpi[] = [
    { label: t('portal.sidebar.totalContracts'), value: String(totalCount) },
    { label: t('portal.sidebar.active'), value: String(activeCount), color: '#22C55E' },
  ];

  const overviewContent = (
    <Card>
      <CardHeader><CardTitle>{t('portal.operator.overview')}</CardTitle></CardHeader>
      <CardBody>
        <KVRow label={t('portal.activeContracts')} value={String(activeCount)} />
        <KVRow label={t('portal.poolBalance')} value={`${poolBalance.toFixed(2)} USDC`} />
      </CardBody>
    </Card>
  );

  return (
    <PortalShell
      header={<PortalHeader role={null} masterPDA={masterPDAStr} roles={allRoles} hideBottomBar />}
      sidebar={
        <PortalSidebar
          portalTitle="Operator Portal"
          roleName={t('portal.role.operator')}
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
    </PortalShell>
  );
}
