import { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/layout/PageShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { TabBar, type TabDef } from '@/components/layout/TabBar';
import { Tag, Mono } from '@/components/common';
import { useParticipantRole } from '@/hooks/useParticipantRole';
import { useMyPolicies, type MyPolicySummary } from '@/hooks/useMyPolicies';
import { PortalOverview } from '@/components/tabs/tab-portal/PortalOverview';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalRiskDashboard } from '@/components/tabs/tab-portal/PortalRiskDashboard';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { MasterPolicyStatus } from '@/lib/idl/open_parametric';

const CenterBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
  color: ${p => p.theme.colors.sub};
  font-size: 13px;
  text-align: center;
`;

const ErrorBox = styled.div`
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid ${p => p.theme.colors.danger};
  background: rgba(239,68,68,.06);
  color: ${p => p.theme.colors.danger};
  font-size: 11px;
  margin: 20px auto;
  max-width: 500px;
  text-align: center;
`;

const TabContent = styled.div<{ visible: boolean }>`
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const PolicyListWrap = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
`;

const PolicyListTitle = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
  margin-bottom: 16px;
  text-align: center;
`;

const PolicyCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.surface1};
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${p => p.theme.colors.primary};
    background: ${p => p.theme.colors.surface2};
  }
`;

const PolicyInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PolicyMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PolicyId = styled.span`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 11px;
  font-weight: 600;
  color: ${p => p.theme.colors.text};
`;

const PolicyPda = styled(Mono)`
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
`;

const ROLE_COLORS: Record<string, string> = {
  leader: '#9945FF',
  partA: '#22C55E',
  partB: '#F59E0B',
  rein: '#38BDF8',
};

const STATUS_LABELS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: 'Draft',
  [MasterPolicyStatus.PendingConfirm]: 'Pending',
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

const RoleTagsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

function PolicyListItem({ policy, onClick }: { policy: MyPolicySummary; onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <PolicyCard onClick={onClick}>
      <PolicyInfo>
        <RoleTagsWrap>
          {policy.roles.map(r => (
            <Tag key={r.role} variant="subtle" style={{ color: ROLE_COLORS[r.role] || '#94A3B8', fontSize: 9, minWidth: 48, textAlign: 'center' }}>
              {t(`portal.role.${r.role}`, r.role)}
            </Tag>
          ))}
        </RoleTagsWrap>
        <PolicyMeta>
          <PolicyId>Master #{policy.masterId}</PolicyId>
          <PolicyPda>{policy.pda.slice(0, 12)}...{policy.pda.slice(-8)}</PolicyPda>
        </PolicyMeta>
      </PolicyInfo>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag variant="subtle" style={{ color: STATUS_COLORS[policy.status] || '#94A3B8', fontSize: 8 }}>
          {STATUS_LABELS[policy.status] || 'Unknown'}
        </Tag>
      </div>
    </PolicyCard>
  );
}

export function PortalPage() {
  const { t } = useTranslation();
  const { publicKey, connected } = useWallet();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { policies, loading: policiesLoading } = useMyPolicies();

  const masterParam = searchParams.get('master');
  const masterPDA = useMemo(() => {
    if (!masterParam) return null;
    try { return new PublicKey(masterParam); }
    catch { return null; }
  }, [masterParam]);

  const { info: participantInfo, roles, loading, error } = useParticipantRole(masterPDA);

  const roleSet = useMemo(() => new Set(roles.map(r => r.role)), [roles]);
  const primaryRole = participantInfo?.role ?? null;

  const tabs: TabDef[] = useMemo(() => {
    const common: TabDef[] = [
      { id: 'overview', label: t('portal.overview') },
      { id: 'contracts', label: t('portal.contracts') },
    ];
    if (roleSet.has('leader') || roleSet.has('partA') || roleSet.has('partB')) {
      common.push({ id: 'confirm', label: t('portal.confirm') });
    }
    if (roleSet.has('leader') || roleSet.has('rein')) {
      common.push({ id: 'risk', label: t('portal.riskDashboard') });
    }
    common.push({ id: 'settlement', label: t('portal.settlement') });
    return common;
  }, [roleSet, t]);

  const [activeTab, setActiveTab] = useState('overview');

  // Not connected
  if (!connected || !publicKey) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={null} />}>
        <CenterBox>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
          <div>{t('portal.connectWallet')}</div>
          <WalletMultiButton />
        </CenterBox>
      </PageShell>
    );
  }

  // No master PDA specified — show my policies list
  if (!masterPDA) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={null} />}>
        <PolicyListWrap>
          <PolicyListTitle>{t('portal.myPolicies')}</PolicyListTitle>
          {policiesLoading ? (
            <CenterBox style={{ minHeight: '30vh' }}>
              <div>{t('portal.loadingPolicies')}</div>
            </CenterBox>
          ) : policies.length === 0 ? (
            <CenterBox style={{ minHeight: '30vh' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div>{t('portal.noPolicies')}</div>
              <div style={{ fontSize: 10, color: 'var(--sub)' }}>
                {t('portal.noPoliciesHint')}
              </div>
            </CenterBox>
          ) : (
            policies.map(p => (
              <PolicyListItem
                key={p.pda}
                policy={p}
                onClick={() => navigate(`/portal?master=${p.pda}`)}
              />
            ))
          )}
        </PolicyListWrap>
      </PageShell>
    );
  }

  // Loading role detection
  if (loading) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <CenterBox>
          <div>{t('portal.detectingRole')}</div>
        </CenterBox>
      </PageShell>
    );
  }

  // Error
  if (error) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <ErrorBox>{error}</ErrorBox>
      </PageShell>
    );
  }

  // No permission
  if (!participantInfo || roles.length === 0) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <CenterBox>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🚫</div>
          <div>{t('portal.noPermission')}</div>
        </CenterBox>
      </PageShell>
    );
  }

  // Find role-specific info for each tab
  const reinInfo = roles.find(r => r.role === 'rein') ?? participantInfo;
  const participantRoleInfo = roles.find(r => r.role === 'partA' || r.role === 'partB') ?? participantInfo;

  return (
    <PageShell header={<PortalHeader role={primaryRole} masterPDA={masterParam} roles={roles} />}>
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <TabContent visible={activeTab === 'overview'}>
        <PortalOverview participantInfo={participantInfo} allRoles={roles} />
      </TabContent>
      <TabContent visible={activeTab === 'contracts'}>
        <PortalContracts masterPDA={masterPDA} />
      </TabContent>
      {(roleSet.has('leader') || roleSet.has('partA') || roleSet.has('partB')) && (
        <TabContent visible={activeTab === 'confirm'}>
          <PortalConfirm masterPDA={masterPDA} participantInfo={participantRoleInfo} allRoles={roles} />
        </TabContent>
      )}
      {(roleSet.has('leader') || roleSet.has('rein')) && (
        <TabContent visible={activeTab === 'risk'}>
          <PortalRiskDashboard participantInfo={reinInfo} allRoles={roles} />
        </TabContent>
      )}
      <TabContent visible={activeTab === 'settlement'}>
        <PortalSettlement participantInfo={participantInfo} allRoles={roles} />
      </TabContent>
    </PageShell>
  );
}
