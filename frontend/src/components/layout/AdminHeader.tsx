import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Mono } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useProgram } from '@/hooks/useProgram';
import { MasterAgreementDropdown } from './MasterAgreementDropdown';
import { useGuideTour } from '@/components/guide/useGuideTour';
import { BaseHeader } from './BaseHeader';

const blink = keyframes`
  0%, 100% { opacity: 1 }
  50% { opacity: 0.6 }
`;

/* ── Mode Toggle ── */

const ModeToggleWrap = styled.div`
  display: flex;
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 20px;
  padding: 2px;
  gap: 2px;
`;

const ModeBtn = styled.button<{ active?: boolean; variant: 'sim' | 'chain' }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 18px;
  border: none;
  font-size: 10px;
  font-weight: 700;
  font-family: ${p => p.theme.fonts.mono};
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.active
    ? (p.variant === 'sim' ? 'rgba(20,241,149,.12)' : 'rgba(153,69,255,.15)')
    : 'transparent'};
  color: ${p => p.active
    ? (p.variant === 'sim' ? p.theme.colors.accent : p.theme.colors.primary)
    : p.theme.colors.sub};
  &:hover {
    background: ${p => !p.active && 'rgba(148,163,184,.08)'};
  }
`;

const ModeDot = styled.div<{ variant: 'sim' | 'chain'; active?: boolean }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${p => p.active
    ? (p.variant === 'sim' ? p.theme.colors.accent : p.theme.colors.primary)
    : p.theme.colors.sub};
  box-shadow: ${p => p.active
    ? (p.variant === 'sim' ? `0 0 5px ${p.theme.colors.accent}` : `0 0 5px ${p.theme.colors.primary}`)
    : 'none'};
  animation: ${p => p.active ? blink : 'none'} 2s infinite;
`;

/* ── Sim Reset Button (sim 모드 전용) ── */

const SimResetBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 18px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  color: ${p => p.theme.colors.danger};
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(239, 68, 68, 0.16);
    border-color: rgba(239, 68, 68, 0.55);
  }

  &:active {
    transform: scale(0.96);
  }
`;

/* ── Selects ── */

const SelectBase = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  padding: 5px 24px 5px 9px;
  border-radius: 7px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
`;

const ROLE_COLOR_DEFAULT = { bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.4)', color: '#94A3B8' };
const ROLE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  leader:   { bg: 'rgba(153,69,255,.15)',  border: 'rgba(153,69,255,.5)',  color: '#9945FF' },
  partA:    { bg: 'rgba(59,130,246,.13)',  border: 'rgba(59,130,246,.45)', color: '#60A5FA' },
  partB:    { bg: 'rgba(20,184,166,.13)',  border: 'rgba(20,184,166,.45)', color: '#2DD4BF' },
  rein:     { bg: 'rgba(249,115,22,.13)',  border: 'rgba(249,115,22,.45)', color: '#FB923C' },
  operator: ROLE_COLOR_DEFAULT,
};
function getRoleStyle(role: string) {
  const c = ROLE_COLORS[role];
  return c !== undefined ? c : ROLE_COLOR_DEFAULT;
}

const RoleBadge = styled.div<{ role: string }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid ${p => getRoleStyle(p.role).border};
  background: ${p => getRoleStyle(p.role).bg};
  color: ${p => getRoleStyle(p.role).color};
  font-family: ${p => p.theme.fonts.mono};
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;

  &::before {
    content: '';
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }
`;

/* ── Wallet Button Override ── */

const guideGlow = keyframes`
  0%, 100% { box-shadow: 0 0 4px rgba(20,241,149,0.3); }
  50% { box-shadow: 0 0 12px rgba(20,241,149,0.5); }
`;

const GuideBtn = styled.button`
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px solid rgba(20, 241, 149, 0.4);
  background: rgba(20, 241, 149, 0.08);
  color: #14F195;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  animation: ${guideGlow} 2s ease-in-out infinite;
  white-space: nowrap;
  &:hover {
    background: rgba(20, 241, 149, 0.18);
    transform: scale(1.05);
  }
`;

const WalletWrap = styled.div<{ dimmed?: boolean }>`
  opacity: ${p => p.dimmed ? 0.4 : 1};
  transition: opacity 0.2s;

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

  .wallet-adapter-button-trigger:hover {
    background: rgba(153,69,255,.25) !important;
  }

  .wallet-adapter-button > i,
  .wallet-adapter-button > img,
  .wallet-adapter-button-start-icon {
    width: 14px !important;
    height: 14px !important;
    margin-right: 5px !important;
  }
`;

/* ── KPI Bar ── */

const KpiBar = styled.div`
  display: flex;
  padding: 6px 18px;
  margin: 0 -18px;
  border-top: 1px solid ${p => p.theme.colors.border};
`;

const Kpi = styled.div`
  flex: 1;
  padding: 5px 14px;
  border-right: 1px solid ${p => p.theme.colors.border};
  &:first-of-type { padding-left: 0; }
  &:last-child { border-right: none; }
`;

const KpiLabel = styled.div`
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 2px;
`;

const KpiValue = styled(Mono)`
  font-size: 14px;
  font-weight: 500;
  transition: color 0.4s;
  display: block;
`;

export function AdminHeader() {
  const { mode, setMode, role, masterAgreementPDA, masterActive, contracts, totalPremium, totalClaim, poolBalance, resetAll } = useProtocolStore(
    useShallow(s => ({ mode: s.mode, setMode: s.setMode, role: s.role, masterAgreementPDA: s.masterAgreementPDA, masterActive: s.masterActive, contracts: s.contracts, totalPremium: s.totalPremium, totalClaim: s.totalClaim, poolBalance: s.poolBalance, resetAll: s.resetAll })),
  );
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { connected } = useProgram();
  const { startTour } = useGuideTour();

  const handleModeSwitch = (m: 'simulation' | 'onchain') => {
    if (m === 'onchain' && !connected) {
      toast('Connect wallet first to use on-chain mode', 'w');
      return;
    }
    setMode(m);
  };

  const handleSimReset = () => {
    if (!window.confirm(t('header.simReset.confirm'))) return;
    resetAll();
    toast(t('toast.resetDone'), 's');
  };

  const kpis = [
    { label: t('header.kpi.masterContract'), value: masterActive ? t('common.active') : t('common.inactive'), highlight: masterActive },
    { label: t('header.kpi.activeContracts'), value: t('common.count', { count: contracts.length }) },
    { label: t('header.kpi.totalPremium'), value: formatNum(totalPremium, 2) + ' USDC' },
    { label: t('header.kpi.totalClaim'), value: formatNum(totalClaim, 2) + ' USDC' },
    { label: t('header.kpi.poolBalance'), value: formatNum(poolBalance, 2) + ' USDC' },
    { label: t('header.kpi.poolHealth'), value: formatNum(poolBalance + totalClaim > 0 ? Math.min(100, (poolBalance / (poolBalance + totalClaim)) * 100) : 100, 1) + '%' },
  ];

  const nav = (
    <>
      <GuideBtn onClick={startTour} title="Guide Tour">Guide</GuideBtn>
      <ModeToggleWrap>
        <ModeBtn variant="chain" active={mode === 'onchain'} onClick={() => handleModeSwitch('onchain')}>
          <ModeDot variant="chain" active={mode === 'onchain'} />
          DEVNET
        </ModeBtn>
        <ModeBtn variant="sim" active={mode === 'simulation'} onClick={() => handleModeSwitch('simulation')}>
          <ModeDot variant="sim" active={mode === 'simulation'} />
          SIM
        </ModeBtn>
      </ModeToggleWrap>
      {mode === 'simulation' && (
        <SimResetBtn onClick={handleSimReset} title={t('header.simReset.confirm')}>
          {t('header.simReset.btn')}
        </SimResetBtn>
      )}
      <MasterAgreementDropdown />
    </>
  );

  const actions = (
    <>
      {mode === 'onchain' && connected && masterAgreementPDA && (
        <RoleBadge role={role} data-guide="role-select">
          {t(`role.${role}`)}
        </RoleBadge>
      )}
      <SelectBase value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </SelectBase>
      <WalletWrap dimmed={mode === 'simulation'}>
        <WalletMultiButton />
      </WalletWrap>
    </>
  );

  const bottomBar = (
    <KpiBar>
      {kpis.map(kpi => (
        <Kpi key={kpi.label}>
          <KpiLabel>{kpi.label}</KpiLabel>
          <KpiValue style={kpi.highlight ? { color: 'var(--accent)' } : undefined}>
            {kpi.value}
          </KpiValue>
        </Kpi>
      ))}
    </KpiBar>
  );

  return <BaseHeader nav={nav} actions={actions} bottomBar={bottomBar} pageTitle={t('dashboard.title')} />;
}
