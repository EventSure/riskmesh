import { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/layout/PageShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { TabBar, type TabDef } from '@/components/layout/TabBar';
import { Tag, Mono, Card } from '@/components/common';
import { useParticipantRole } from '@/hooks/useParticipantRole';
import { useMyPolicies, type MyPolicySummary } from '@/hooks/useMyPolicies';
import { PortalOverview } from '@/components/tabs/tab-portal/PortalOverview';
import { PortalContracts } from '@/components/tabs/tab-portal/PortalContracts';
import { PortalConfirm } from '@/components/tabs/tab-portal/PortalConfirm';
import { PortalRiskDashboard } from '@/components/tabs/tab-portal/PortalRiskDashboard';
import { PortalSettlement } from '@/components/tabs/tab-portal/PortalSettlement';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { MasterPolicyStatus, POLICY_STATE_LABELS, PolicyState } from '@/lib/idl/open_parametric';

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

const TRACK_B_STATUS_COLORS: Record<number, string> = {
  [PolicyState.Draft]: '#94A3B8',
  [PolicyState.Open]: '#38BDF8',
  [PolicyState.Funded]: '#F59E0B',
  [PolicyState.Active]: '#22C55E',
  [PolicyState.Claimable]: '#EF4444',
  [PolicyState.Approved]: '#9945FF',
  [PolicyState.Settled]: '#64748B',
  [PolicyState.Expired]: '#475569',
};

const RoleTagsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

function PolicyListItem({ policy, onClick }: { policy: MyPolicySummary; onClick: () => void }) {
  const { t } = useTranslation();

  const isTrackB = policy.track === 'B';
  const statusColor = isTrackB
    ? (TRACK_B_STATUS_COLORS[policy.status] || '#94A3B8')
    : (STATUS_COLORS[policy.status] || '#94A3B8');
  const statusLabel = isTrackB
    ? (POLICY_STATE_LABELS[policy.status] || 'Unknown')
    : (STATUS_LABELS[policy.status] || 'Unknown');

  return (
    <PolicyCard onClick={onClick}>
      <PolicyInfo>
        <RoleTagsWrap>
          <Tag variant="subtle" style={{ color: isTrackB ? '#9945FF' : '#22C55E', fontSize: 8, minWidth: 40, textAlign: 'center' }}>
            {isTrackB ? 'Track B' : 'Track A'}
          </Tag>
          {policy.roles.map(r => (
            <Tag key={r.role} variant="subtle" style={{ color: ROLE_COLORS[r.role] || '#94A3B8', fontSize: 9, minWidth: 48, textAlign: 'center' }}>
              {t(`portal.role.${r.role}`, r.role)}
            </Tag>
          ))}
        </RoleTagsWrap>
        <PolicyMeta>
          <PolicyId>{isTrackB ? `Policy #${policy.masterId}` : `Master #${policy.masterId}`}</PolicyId>
          {isTrackB && policy.flightNo && (
            <PolicyPda>{policy.flightNo} · {policy.route}</PolicyPda>
          )}
          {!isTrackB && (
            <PolicyPda>{policy.pda.slice(0, 12)}...{policy.pda.slice(-8)}</PolicyPda>
          )}
        </PolicyMeta>
      </PolicyInfo>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag variant="subtle" style={{ color: statusColor, fontSize: 8 }}>
          {statusLabel}
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
  const trackBParam = searchParams.get('trackb');
  const masterPDA = useMemo(() => {
    if (!masterParam) return null;
    try { return new PublicKey(masterParam); }
    catch { return null; }
  }, [masterParam]);
  const trackBPDA = useMemo(() => {
    if (!trackBParam) return null;
    try { return new PublicKey(trackBParam); }
    catch { return null; }
  }, [trackBParam]);

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

  // Track B policy detail view
  if (trackBPDA && !masterPDA) {
    const matchedPolicy = policies.find(p => p.pda === trackBParam && p.track === 'B');
    return (
      <PageShell header={<PortalHeader role="leader" masterPDA={trackBParam} />}>
        <PolicyListWrap>
          <PolicyListTitle>{t('portal.trackBPolicy')}</PolicyListTitle>
          {matchedPolicy ? (
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <PolicyId>Policy #{matchedPolicy.masterId}</PolicyId>
                  <Tag variant="subtle" style={{ color: TRACK_B_STATUS_COLORS[matchedPolicy.status] || '#94A3B8', fontSize: 9 }}>
                    {POLICY_STATE_LABELS[matchedPolicy.status] || 'Unknown'}
                  </Tag>
                </div>
                {matchedPolicy.flightNo && (
                  <div style={{ fontSize: 12, color: 'var(--sub)' }}>
                    {matchedPolicy.flightNo} · {matchedPolicy.route}
                  </div>
                )}
                {matchedPolicy.payoutAmount != null && (
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>
                    {t('portal.payout')}: <Mono>{matchedPolicy.payoutAmount.toFixed(2)} USDC</Mono>
                  </div>
                )}
                <PolicyPda>{matchedPolicy.pda}</PolicyPda>
              </div>
            </Card>
          ) : (
            <CenterBox style={{ minHeight: '20vh' }}>
              <div>{t('portal.loadingPolicies')}</div>
            </CenterBox>
          )}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Tag variant="subtle" style={{ cursor: 'pointer', fontSize: 11 }} onClick={() => navigate('/portal')}>
              {t('portal.myPolicies')}
            </Tag>
          </div>
        </PolicyListWrap>
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
                onClick={() => navigate(
                  p.track === 'B'
                    ? `/portal?trackb=${p.pda}`
                    : `/portal?master=${p.pda}`,
                )}
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
        <PortalOverview participantInfo={participantInfo} allRoles={roles} masterPDA={masterPDA} />
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
