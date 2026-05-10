import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BaseHeader } from './BaseHeader';
import { Mono } from '@/components/common';
import { useThemeModeContext } from '@/context/ThemeModeContext';
import { useMyPolicies, type MyPolicySummary } from '@/hooks/useMyPolicies';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';
import { MasterAgreementStatus } from '@/lib/idl/open_parametric';

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PolicySelect = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: 7px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  max-width: 220px;
`;

const ThemeToggle = styled.button`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: ${p => p.theme.radii.pill};
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: ${p => p.theme.colors.sub};
  transition: all 0.2s;

  &:hover {
    border-color: ${p => p.theme.colors.primary};
  }
`;

const LangSelect = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: ${p => p.theme.radii.sm};
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
`;

const WalletWrap = styled.div`
  .wallet-adapter-button {
    height: 28px !important;
    padding: 0 12px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    font-family: ${p => p.theme.fonts.mono} !important;
    border-radius: 20px !important;
    background: ${p => p.theme.colors.card} !important;
    border: 1px solid ${p => p.theme.colors.border} !important;
    color: ${p => p.theme.colors.text} !important;
    line-height: 1 !important;
    transition: all 0.2s !important;
  }
  .wallet-adapter-button:hover {
    border-color: ${p => p.theme.colors.primary} !important;
    background: rgba(153,69,255,.08) !important;
  }
  .wallet-adapter-button-trigger {
    background: rgba(153,69,255,.15) !important;
    border-color: ${p => p.theme.colors.primary} !important;
    color: ${p => p.theme.colors.primary} !important;
  }
  .wallet-adapter-button > i,
  .wallet-adapter-button > img,
  .wallet-adapter-button-start-icon {
    width: 14px !important;
    height: 14px !important;
    margin-right: 5px !important;
  }
`;

const InfoBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 18px;
  margin: 0 -18px;
  border-top: 1px solid ${p => p.theme.colors.border};
`;

const RoleBadge = styled.div<{ roleColor: string }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: ${p => p.theme.radii.pill};
  border: 1px solid ${p => p.roleColor};
  background: ${p => p.roleColor}12;
  font-size: 11px;
  font-weight: 700;
  color: ${p => p.roleColor};
`;

const RoleDot = styled.div<{ color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.color};
`;

const PdaBadge = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: ${p => p.theme.radii.pill};
  border: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.surface2};
  font-size: 11px;
  color: ${p => p.theme.colors.sub};
`;

const ROLE_COLORS: Record<string, string> = {
  leader: '#9945FF',
  participant: '#22C55E',
  rein: '#38BDF8',
};

const POLICY_ROLE_LABEL: Record<string, string> = {
  leader: '리더사',
  partA: '참여사',
  partB: '참여사',
  rein: '재보험사',
};

function policyStatusLabel(p: MyPolicySummary): string {
  if (p.track === 'B') return p.statusLabel || 'Unknown';
  if (p.status === MasterAgreementStatus.Active) return 'Active';
  if (p.status === MasterAgreementStatus.PendingConfirm) return 'Pending';
  if (p.status === MasterAgreementStatus.Closed) return 'Closed';
  if (p.status === MasterAgreementStatus.Cancelled) return 'Cancelled';
  return 'Draft';
}

function formatPolicyDate(ts?: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
  });
}

interface PortalHeaderProps {
  role: 'leader' | 'participant' | 'rein' | null;
  masterPDA: string | null;
  roles?: ParticipantInfo[];
  hideBottomBar?: boolean;
  pageTitle?: string;
}

export function PortalHeader({ role, masterPDA, roles, hideBottomBar = false, pageTitle }: PortalHeaderProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { mode, toggle } = useThemeModeContext();
  const { policies } = useMyPolicies();

  const displayRoles = roles && roles.length > 0 ? roles : role ? [{ role }] : [];

  const handlePolicyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      navigate('/portal');
      return;
    }
    const policy = policies.find(p => p.pda === val);
    if (policy?.track === 'B') {
      navigate(`/portal?trackb=${val}`);
    } else {
      navigate(`/portal?master=${val}`);
    }
  };

  const actions = (
    <Controls>
      {policies.length > 0 && (
        <PolicySelect value={masterPDA ?? ''} onChange={handlePolicyChange}>
          <option value="">{t('portal.selectPolicy')}</option>
          {policies.map(p => {
            const role = p.roles[0]?.role;
            const roleLabel = role ? (POLICY_ROLE_LABEL[role] || '') : '';
            const dateStr = formatPolicyDate(p.coverageEndTs);
            const parts = [
              `${p.pda.slice(0, 8)}...`,
              policyStatusLabel(p),
              roleLabel,
              dateStr,
            ].filter(Boolean);
            return (
              <option key={p.pda} value={p.pda}>
                {parts.join(' · ')}
              </option>
            );
          })}
        </PolicySelect>
      )}
      <ThemeToggle onClick={toggle} aria-label="테마 전환">
        {mode === 'dark' ? '☀️' : '🌙'}
      </ThemeToggle>
      <LangSelect value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
        <option value="en">EN</option>
        <option value="ko">KO</option>
      </LangSelect>
      <WalletWrap>
        <WalletMultiButton />
      </WalletWrap>
    </Controls>
  );

  const bottomBar = (displayRoles.length > 0 || masterPDA) ? (
    <InfoBar>
      {displayRoles.map(r => {
        const color = r.role ? ROLE_COLORS[r.role] || '#94A3B8' : '#94A3B8';
        const label = r.role ? t(`portal.role.${r.role}`) : t('portal.noRole');
        return (
          <RoleBadge key={r.role ?? 'none'} roleColor={color}>
            <RoleDot color={color} />
            {label}
          </RoleBadge>
        );
      })}
      {masterPDA && (
        <PdaBadge>
          <Mono style={{ fontSize: 9 }}>{masterPDA.slice(0, 8)}...{masterPDA.slice(-6)}</Mono>
        </PdaBadge>
      )}
    </InfoBar>
  ) : null;

  return <BaseHeader actions={actions} bottomBar={hideBottomBar ? undefined : bottomBar} pageTitle={pageTitle} />;
}
