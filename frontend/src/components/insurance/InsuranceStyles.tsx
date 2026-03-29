import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

/* ── Insurance brand colors ── */
const ins = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',
  heroBg: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
  heroOverlay: 'linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.95) 100%)',
  cardBg: 'rgba(30,41,59,0.6)',
  sectionAlt: '#0D1424',
  completeBg: 'linear-gradient(135deg, #064E3B 0%, #0F172A 100%)',
};

/* ── Animations ── */
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

/* ── Page Shell ── */
export const PageWrap = styled.div`
  min-height: 100vh;
  background: ${p => p.theme.colors.bg};
  color: ${p => p.theme.colors.text};
  font-family: ${p => p.theme.fonts.sans};
  display: flex;
  flex-direction: column;
`;

/* ── Header ── */
export const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(11, 17, 32, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${p => p.theme.colors.border};
  position: sticky;
  top: 0;
  z-index: 100;

  ${p => p.theme.mediaQueries.md} {
    padding: 16px 48px;
  }
`;

export const BrandWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const BrandIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${ins.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  font-weight: 700;
`;

export const BrandName = styled.span`
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${p => p.theme.colors.text};
`;

export const BrandSub = styled.span`
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
  margin-left: 8px;
  font-weight: 400;
`;

/* ── Hero ── */
export const HeroWrap = styled.section`
  position: relative;
  padding: 80px 24px 72px;
  background: ${ins.heroBg};
  text-align: center;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${ins.heroOverlay};
    pointer-events: none;
  }

  ${p => p.theme.mediaQueries.md} {
    padding: 120px 48px 100px;
  }
`;

export const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 680px;
  margin: 0 auto;
  animation: ${fadeInUp} 0.7s ease-out;
`;

export const HeroTag = styled.span`
  display: inline-block;
  padding: 5px 14px;
  border-radius: 20px;
  background: rgba(37, 99, 235, 0.15);
  border: 1px solid rgba(37, 99, 235, 0.3);
  color: ${ins.primaryLight};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 20px;
`;

export const HeroTitle = styled.h1`
  font-size: 28px;
  font-weight: 800;
  line-height: 1.3;
  margin: 0 0 16px;
  letter-spacing: -0.02em;

  ${p => p.theme.mediaQueries.md} {
    font-size: 40px;
  }
`;

export const HeroSubtitle = styled.p`
  font-size: 15px;
  color: ${p => p.theme.colors.sub};
  line-height: 1.6;
  margin: 0 0 32px;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;

  ${p => p.theme.mediaQueries.md} {
    font-size: 17px;
  }
`;

export const HeroCTA = styled.button`
  padding: 14px 36px;
  border: none;
  border-radius: 10px;
  background: ${ins.primary};
  color: #fff;
  font-family: ${p => p.theme.fonts.sans};
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 4px 24px rgba(37, 99, 235, 0.3);

  &:hover {
    background: ${ins.primaryDark};
    transform: translateY(-2px);
    box-shadow: 0 6px 32px rgba(37, 99, 235, 0.4);
  }
`;

/* ── Section Container ── */
export const Section = styled.section<{ alt?: boolean }>`
  padding: 64px 24px;
  background: ${p => (p.alt ? ins.sectionAlt : 'transparent')};

  ${p => p.theme.mediaQueries.md} {
    padding: 80px 48px;
  }
`;

export const SectionInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
`;

export const SectionTitle = styled.h2`
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 40px;
  letter-spacing: -0.01em;

  ${p => p.theme.mediaQueries.md} {
    font-size: 26px;
  }
`;

/* ── Point Cards ── */
export const PointGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  ${p => p.theme.mediaQueries.md} {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
`;

export const PointCard = styled.div`
  padding: 28px 24px;
  border-radius: 12px;
  background: ${ins.cardBg};
  border: 1px solid ${p => p.theme.colors.border};
  backdrop-filter: blur(8px);
  transition: all 0.25s;

  &:hover {
    border-color: rgba(37, 99, 235, 0.4);
    transform: translateY(-2px);
  }
`;

export const PointIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 16px;
`;

export const PointTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 8px;
`;

export const PointDesc = styled.p`
  font-size: 13px;
  color: ${p => p.theme.colors.sub};
  line-height: 1.6;
  margin: 0;
`;

/* ── Enrollment Form Section ── */
export const FormSection = styled.section`
  padding: 64px 24px;
  background: ${ins.sectionAlt};

  ${p => p.theme.mediaQueries.md} {
    padding: 80px 48px;
  }
`;

export const FormCard = styled.div`
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 28px;
  border-radius: 14px;
  background: ${ins.cardBg};
  border: 1px solid ${p => p.theme.colors.border};
  backdrop-filter: blur(8px);
`;

export const FormTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 28px;
`;

export const SubmitBtn = styled.button<{ $loading?: boolean }>`
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: ${p => (p.$loading ? p.theme.colors.sub : ins.primary)};
  color: #fff;
  font-family: ${p => p.theme.fonts.sans};
  font-size: 14px;
  font-weight: 700;
  cursor: ${p => (p.$loading ? 'not-allowed' : 'pointer')};
  transition: all 0.25s;
  margin-top: 8px;

  ${p =>
    !p.$loading &&
    `
    &:hover {
      background: ${ins.primaryDark};
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3);
    }
  `}

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
`;

export const PremiumDisplay = styled.div`
  width: 100%;
  padding: 10px 12px;
  background: ${p => p.theme.colors.card2};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 8px;
  color: ${ins.primaryLight};
  font-family: 'DM Mono', monospace;
  font-size: 14px;
  font-weight: 600;
`;

/* ── Completion ── */
export const CompleteWrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: ${ins.completeBg};
  min-height: 60vh;
`;

export const CompleteCard = styled.div`
  max-width: 460px;
  width: 100%;
  padding: 36px 32px;
  border-radius: 16px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(20, 241, 149, 0.2);
  backdrop-filter: blur(12px);
  animation: ${fadeInUp} 0.5s ease-out;
`;

export const CompleteIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(20, 241, 149, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin: 0 auto 20px;
`;

export const CompleteTitle = styled.h2`
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 24px;
  color: ${p => p.theme.colors.accent};
`;

export const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  font-size: 13px;

  &:last-of-type {
    border-bottom: none;
  }
`;

export const SummaryLabel = styled.span`
  color: ${p => p.theme.colors.sub};
`;

export const SummaryValue = styled.span`
  font-weight: 600;
  font-family: 'DM Mono', monospace;
  color: ${p => p.theme.colors.text};
`;

export const CompleteMessage = styled.p`
  font-size: 13px;
  color: ${p => p.theme.colors.sub};
  line-height: 1.7;
  text-align: center;
  margin: 20px 0 24px;
  padding: 0 8px;
`;

export const ConfirmBtn = styled.button`
  width: 100%;
  padding: 13px;
  border: none;
  border-radius: 10px;
  background: ${p => p.theme.colors.accent};
  color: #0B1120;
  font-family: ${p => p.theme.fonts.sans};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    box-shadow: 0 0 20px rgba(20, 241, 149, 0.25);
    transform: translateY(-1px);
  }
`;

/* ── Footer ── */
export const Footer = styled.footer`
  padding: 24px 32px;
  text-align: center;
  border-top: 1px solid ${p => p.theme.colors.border};
  font-size: 11px;
  color: ${p => p.theme.colors.sub};
  display: flex;
  flex-direction: column;
  gap: 4px;

  ${p => p.theme.mediaQueries.md} {
    flex-direction: row;
    justify-content: center;
    gap: 16px;
  }
`;

/* ── Loading shimmer for submit button ── */
export const ShimmerText = styled.span`
  background: linear-gradient(90deg, #fff 25%, #94a3b8 50%, #fff 75%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 1.5s infinite linear;
`;
