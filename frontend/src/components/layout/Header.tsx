import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Mono } from '@/components/common';

const blink = keyframes`
  0%, 100% { opacity: 1 }
  50% { opacity: 0.6 }
`;

const HeaderWrap = styled.header`
  background: rgba(11, 17, 32, 0.97);
  border-bottom: 1px solid ${p => p.theme.colors.border};
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(16px);
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 10px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const LogoMark = styled.div`
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, ${p => p.theme.colors.primary}, ${p => p.theme.colors.accent});
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 0 20px ${p => p.theme.glow.primary};
`;

const LogoName = styled.div`
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.03em;
`;

const LogoSub = styled.div`
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 1px;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const NetPill = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 11px;
  font-family: ${p => p.theme.fonts.mono};
`;

const NetDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.theme.colors.accent};
  box-shadow: 0 0 6px ${p => p.theme.colors.accent};
  animation: ${blink} 2s infinite;
`;

const RoleSelect = styled.select`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  padding: 6px 28px 6px 10px;
  border-radius: 8px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
`;

const RoleBadge = styled.span`
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: ${p => p.theme.fonts.mono};
  background: rgba(20, 241, 149, 0.1);
  color: ${p => p.theme.colors.accent};
  border: 1px solid rgba(20, 241, 149, 0.3);
  animation: ${blink} 2s infinite;
`;

const KpiBar = styled.div`
  display: flex;
  padding: 8px 0;
`;

const Kpi = styled.div`
  flex: 1;
  padding: 6px 16px;
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
  letter-spacing: 0.1em;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 2px;
`;

const KpiValue = styled(Mono)`
  font-size: 16px;
  font-weight: 500;
  transition: color 0.4s;
  display: block;
`;

const kpis = [
  { label: 'Active Policies', value: '0' },
  { label: 'Total Locked Capital', value: '0' },
  { label: 'Total Exposure', value: '0' },
  { label: 'Total Paid Out', value: '0' },
  { label: 'Pool Health', value: '—' },
];

export function Header() {
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
          <RoleSelect>
            <option value="leader">👑 Leader (Insurer)</option>
            <option value="partA">🔵 Participant A</option>
            <option value="partB">🟡 Participant B</option>
            <option value="operator">🛡️ Operator/Admin</option>
          </RoleSelect>
          <RoleBadge>● LIVE DEMO</RoleBadge>
          <WalletMultiButton />
        </HeaderRight>
      </HeaderTop>
      <KpiBar>
        {kpis.map(kpi => (
          <Kpi key={kpi.label}>
            <KpiLabel>{kpi.label}</KpiLabel>
            <KpiValue>{kpi.value}</KpiValue>
          </Kpi>
        ))}
      </KpiBar>
    </HeaderWrap>
  );
}
