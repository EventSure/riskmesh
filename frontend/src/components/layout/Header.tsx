import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { Mono } from '@/components/common';
import { useProtocolStore, formatNum, type Role } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';

const blink = keyframes`
  0%, 100% { opacity: 1 }
  50% { opacity: 0.6 }
`;

const HeaderWrap = styled.header`
  background: rgba(11, 17, 32, 0.97);
  border-bottom: 1px solid ${p => p.theme.colors.border};
  padding: 0 18px;
  position: sticky;
  top: 0;
  z-index: 200;
  backdrop-filter: blur(16px);
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 8px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LogoMark = styled.div`
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, ${p => p.theme.colors.primary}, ${p => p.theme.colors.accent});
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 0 18px ${p => p.theme.glow.primary};
`;

const LogoName = styled.div`
  font-size: 15px;
  font-weight: 700;
`;

const LogoSub = styled.div`
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 1px;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NetPill = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 10px;
  font-family: ${p => p.theme.fonts.mono};
`;

const NetDot = styled.div`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${p => p.theme.colors.accent};
  box-shadow: 0 0 5px ${p => p.theme.colors.accent};
  animation: ${blink} 2s infinite;
`;

const RoleSelect = styled.select`
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

const LangSelect = styled.select`
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

const LiveBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 10px;
  font-family: ${p => p.theme.fonts.mono};
`;

const KpiBar = styled.div`
  display: flex;
  padding: 6px 0;
`;

const Kpi = styled.div`
  flex: 1;
  padding: 5px 14px;
  border-right: 1px solid ${p => p.theme.colors.border};

  &:first-of-type {
    padding-left: 0;
  }
  &:last-child {
    border-right: none;
  }
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

export function Header() {
  const { role, setRole, masterActive, contracts, totalPremium, totalClaim, poolBalance } = useProtocolStore(
    useShallow(s => ({ role: s.role, setRole: s.setRole, masterActive: s.masterActive, contracts: s.contracts, totalPremium: s.totalPremium, totalClaim: s.totalClaim, poolBalance: s.poolBalance })),
  );
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const ROLE_OPTIONS: { value: Role; label: string }[] = [
    { value: 'leader', label: t('role.leader') },
    { value: 'partA', label: t('role.partA') },
    { value: 'partB', label: t('role.partB') },
    { value: 'rein', label: t('role.rein') },
    { value: 'operator', label: t('role.operator') },
  ];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const r = e.target.value as Role;
    setRole(r);
    toast(t('toast.roleChange', { role: t(`role.${r}Short`) }), 'i');
  };

  const kpis = [
    { label: t('header.kpi.masterContract'), value: masterActive ? t('common.active') : t('common.inactive'), highlight: masterActive },
    { label: t('header.kpi.activeContracts'), value: t('common.count', { count: contracts.length }) },
    { label: t('header.kpi.totalPremium'), value: formatNum(totalPremium, 2) + ' USDC' },
    { label: t('header.kpi.totalClaim'), value: formatNum(totalClaim, 2) + ' USDC' },
    { label: t('header.kpi.poolBalance'), value: formatNum(poolBalance, 2) + ' USDC' },
    { label: t('header.kpi.poolHealth'), value: formatNum(Math.min(100, (poolBalance / 10000) * 100), 1) + '%' },
  ];

  return (
    <HeaderWrap>
      <HeaderTop>
        <Logo>
          <LogoMark>OP</LogoMark>
          <div>
            <LogoName>OpenParametric Protocol</LogoName>
            <LogoSub>On-chain Parametric Insurance · Solana Devnet</LogoSub>
          </div>
        </Logo>
        <HeaderRight>
          <NetPill>
            <NetDot />
            devnet
          </NetPill>
          <RoleSelect value={role} onChange={handleRoleChange}>
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </RoleSelect>
          <LangSelect value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
            <option value="ko">🇰🇷 한국어</option>
            <option value="en">🇺🇸 English</option>
          </LangSelect>
          <LiveBadge>
            <NetDot />
            <span style={{ color: 'var(--accent)' }}>LIVE DEMO</span>
          </LiveBadge>
        </HeaderRight>
      </HeaderTop>
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
    </HeaderWrap>
  );
}
