import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { PortalShell } from '@/components/layout/PortalShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { PortalSidebar, type SidebarKpi, type NavTab } from '@/components/layout/PortalSidebar';
import { ActionBanner } from '@/components/portal/ActionBanner';
import { Card, CardHeader, CardTitle, CardBody, FormGroup, FormLabel, FormInput, Button } from '@/components/common';
import { KVRow } from '@/components/tabs/tab-portal/KVRow';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const ROLE_COLOR = '#22C55E';

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'settlement', label: 'Settlement' },
];

interface ParticipantPortalProps {
  masterPDA: PublicKey;
  masterPDAStr: string;
  participantInfo: ParticipantInfo;
  allRoles: ParticipantInfo[];
  onRefresh: () => void;
  poolBalance?: number;
  onFund?: (amount: number) => Promise<void>;
}

export function ParticipantPortal({
  masterPDA,
  masterPDAStr,
  participantInfo,
  allRoles,
  onRefresh,
  poolBalance = 0,
  onFund,
}: ParticipantPortalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [fundAmount, setFundAmount] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const { totalPremium, totalClaim } = useProtocolStore();

  const shareBps = participantInfo.shareBps;
  const myPremium = totalPremium * (shareBps / 10000);
  const myLiability = totalClaim * (shareBps / 10000);

  const sidebarKpis: SidebarKpi[] = [
    { label: t('portal.sidebar.myShare'), value: `${(shareBps / 100).toFixed(1)}%`, color: ROLE_COLOR },
    { label: t('portal.sidebar.myPool'), value: `$${formatNum(poolBalance, 2)}`, color: '#e2e8f0' },
    { label: t('portal.sidebar.status'), value: participantInfo.confirmed ? t('portal.status.confirmed') : t('portal.status.pending'), color: participantInfo.confirmed ? '#22C55E' : '#F59E0B' },
  ];

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0 || !onFund) return;
    setFundLoading(true);
    try {
      await onFund(amount);
      setFundAmount('');
    } finally {
      setFundLoading(false);
    }
  };

  const overviewContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!participantInfo.confirmed && (
        <ActionBanner
          severity="warning"
          title={t('portal.participant.unconfirmedTitle')}
          description={t('portal.participant.unconfirmedDesc')}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Card style={{ borderTop: `2px solid ${ROLE_COLOR}` }}>
          <CardHeader><CardTitle>{t('portal.myShare')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: ROLE_COLOR }}>
              {(shareBps / 100).toFixed(1)}%
            </div>
            <KVRow label="bps" value={String(shareBps)} />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #22C55E' }}>
          <CardHeader><CardTitle>{t('portal.myPremium')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#22C55E' }}>
              {formatNum(myPremium, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
        <Card style={{ borderTop: '2px solid #EF4444' }}>
          <CardHeader><CardTitle>{t('portal.myClaim')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
              {formatNum(myLiability, 2)}
            </div>
            <KVRow label="" value="USDC" />
          </CardBody>
        </Card>
      </div>
      {onFund && (
        <Card>
          <CardHeader><CardTitle>{t('portal.fundMyPool')}</CardTitle></CardHeader>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel>{t('portal.fundAmount')}</FormLabel>
                <FormInput
                  type="number"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </FormGroup>
              <Button
                variant="primary"
                onClick={handleFund}
                disabled={fundLoading || !fundAmount}
                style={{ whiteSpace: 'nowrap', marginBottom: 0 }}
              >
                {fundLoading ? t('portal.funding') : t('portal.fundBtn')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  return (
    <PortalShell
      header={<PortalHeader role="participant" masterPDA={masterPDAStr} roles={allRoles} hideBottomBar pageTitle={t('portal.participantPortalTitle')} />}
      sidebar={
        <PortalSidebar
          portalTitle={t('portal.participantPortalTitle')}
          roleName={t('portal.role.participant')}
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
      {activeTab === 'confirm' && (
        <PortalConfirm masterPDA={masterPDA} participantInfo={participantInfo} allRoles={allRoles} onSuccess={onRefresh} />
      )}
      {activeTab === 'settlement' && <PortalSettlement participantInfo={participantInfo} allRoles={allRoles} />}
    </PortalShell>
  );
}
