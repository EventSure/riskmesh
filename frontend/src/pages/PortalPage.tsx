import { useMemo } from 'react';
import styled from '@emotion/styled';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/layout/PageShell';
import { PortalHeader } from '@/components/layout/PortalHeader';
import { Tag, Mono } from '@/components/common';
import { useParticipantRole } from '@/hooks/useParticipantRole';
import { useMyPolicies, type MyPolicySummary } from '@/hooks/useMyPolicies';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { POLICY_STATE_LABELS, PolicyState, MasterPolicyStatus } from '@/lib/idl/open_parametric';
import { LeaderPortal } from './portal/LeaderPortal';
import { ParticipantPortal } from './portal/ParticipantPortal';
import { ReinPortal } from './portal/ReinPortal';
import { OperatorPortal } from './portal/OperatorPortal';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {policy.roles.map(r => (
          <Tag key={r.role} variant="subtle" style={{ color: ROLE_COLORS[r.role] || '#94A3B8', fontSize: 9, minWidth: 48, textAlign: 'center' }}>
            {t(`portal.role.${r.role}`, r.role)}
          </Tag>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 600 }}>
            {isTrackB ? `Policy #${policy.masterId}` : `Master #${policy.masterId}`}
          </span>
          <Mono style={{ fontSize: 9, color: 'var(--sub)' }}>
            {isTrackB && policy.flightNo
              ? `${policy.flightNo} · ${policy.route}`
              : `${policy.pda.slice(0, 12)}...${policy.pda.slice(-8)}`}
          </Mono>
        </div>
      </div>
      <Tag variant="subtle" style={{ color: statusColor, fontSize: 8 }}>{statusLabel}</Tag>
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

  const { info: participantInfo, roles, loading, error, refresh: refreshRole } = useParticipantRole(masterPDA);
  const primaryRole = roles[0]?.role ?? null;

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

  if (!masterPDA) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={null} />}>
        <PolicyListWrap>
          <PolicyListTitle>{t('portal.myPolicies')}</PolicyListTitle>
          {policiesLoading ? (
            <CenterBox style={{ minHeight: '30vh' }}><div>{t('portal.loadingPolicies')}</div></CenterBox>
          ) : policies.length === 0 ? (
            <CenterBox style={{ minHeight: '30vh' }}>
              <div style={{ fontSize: 32 }}>📋</div>
              <div>{t('portal.noPolicies')}</div>
            </CenterBox>
          ) : (
            policies.map(p => (
              <PolicyListItem
                key={p.pda}
                policy={p}
                onClick={() => navigate(
                  p.track === 'B' ? `/portal?trackb=${p.pda}` : `/portal?master=${p.pda}`,
                )}
              />
            ))
          )}
        </PolicyListWrap>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <CenterBox><div>{t('portal.detectingRole')}</div></CenterBox>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <ErrorBox>{error}</ErrorBox>
      </PageShell>
    );
  }

  if (!participantInfo || roles.length === 0) {
    return (
      <PageShell header={<PortalHeader role={null} masterPDA={masterParam} />}>
        <CenterBox>
          <div style={{ fontSize: 32 }}>🚫</div>
          <div>{t('portal.noPermission')}</div>
        </CenterBox>
      </PageShell>
    );
  }

  if (primaryRole === 'leader') {
    return (
      <LeaderPortal
        masterPDA={masterPDA}
        masterPDAStr={masterParam!}
        participantInfo={participantInfo}
        allRoles={roles}
        onRefresh={refreshRole}
      />
    );
  }

  if (primaryRole === 'rein') {
    return (
      <ReinPortal
        masterPDA={masterPDA}
        masterPDAStr={masterParam!}
        participantInfo={participantInfo}
        allRoles={roles}
        onRefresh={refreshRole}
      />
    );
  }

  if (primaryRole === 'participant') {
    return (
      <ParticipantPortal
        masterPDA={masterPDA}
        masterPDAStr={masterParam!}
        participantInfo={participantInfo}
        allRoles={roles}
        onRefresh={refreshRole}
      />
    );
  }

  return (
    <OperatorPortal
      masterPDA={masterPDA}
      masterPDAStr={masterParam!}
      participantInfo={participantInfo}
      allRoles={roles}
    />
  );
}
