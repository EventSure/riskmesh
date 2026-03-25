import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

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
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover { opacity: 0.75; }
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
  box-shadow: 0 0 18px ${p => p.theme.glowSubtle.primary};
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

export { blink, HeaderWrap, HeaderTop, HeaderRight, Logo, LogoMark, LogoName, LogoSub };

interface BaseHeaderProps {
  nav?: ReactNode;
  actions?: ReactNode;
  bottomBar?: ReactNode;
}

export function BaseHeader({ nav, actions, bottomBar }: BaseHeaderProps) {
  const navigate = useNavigate();

  return (
    <HeaderWrap>
      <HeaderTop>
        <Logo onClick={() => navigate('/')}>
          <LogoMark>OP</LogoMark>
          <div>
            <LogoName>OpenParametric Protocol</LogoName>
            <LogoSub>On-chain Parametric Insurance · Solana</LogoSub>
          </div>
        </Logo>
        <HeaderRight>
          {nav}
          {actions}
        </HeaderRight>
      </HeaderTop>
      {bottomBar}
    </HeaderWrap>
  );
}
