import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';

/* ── Insurance brand colors (light theme) ── */
const ins = {
  primary:      '#2563EB',
  primaryDark:  '#1D4ED8',
  primaryLight: '#3B82F6',
  primaryPale:  '#EFF6FF',
  pageBg:       '#F8FAFC',
  heroBg:       'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #F8FAFC 100%)',
  cardBg:       '#FFFFFF',
  sectionAlt:   '#F1F5F9',
  border:       '#E2E8F0',
  text:         '#0F172A',
  sub:          '#64748B',
  success:      '#059669',
  successPale:  '#ECFDF5',
};

/* ── Animations ── */
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

/* ── Page Shell ── */
export const PageWrap = styled.div`
  min-height: 100vh;
  background: ${ins.pageBg};
  color: ${ins.text};
  font-family: 'Space Grotesk', sans-serif;
  display: flex;
  flex-direction: column;
`;

/* ── Header ── */
export const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${ins.border};
  position: sticky;
  top: 0;
  z-index: 100;
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
  color: ${ins.text};
`;

export const BrandSub = styled.span`
  font-size: 10px;
  color: ${ins.sub};
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
    background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(37,99,235,.07) 0%, transparent 70%);
    pointer-events: none;
  }

  @media (min-width: 768px) {
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
  background: ${ins.primaryPale};
  border: 1px solid rgba(37, 99, 235, 0.2);
  color: ${ins.primary};
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
  color: ${ins.text};

  @media (min-width: 768px) {
    font-size: 40px;
  }
`;

export const HeroSubtitle = styled.p`
  font-size: 15px;
  color: ${ins.sub};
  line-height: 1.6;
  margin: 0 auto 32px;
  max-width: 520px;

  @media (min-width: 768px) {
    font-size: 17px;
  }
`;

export const HeroCTA = styled.button`
  padding: 14px 36px;
  border: none;
  border-radius: 10px;
  background: ${ins.primary};
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 4px 24px rgba(37, 99, 235, 0.25);

  &:hover {
    background: ${ins.primaryDark};
    transform: translateY(-2px);
    box-shadow: 0 6px 32px rgba(37, 99, 235, 0.35);
  }
`;

/* ── Section Container ── */
export const Section = styled.section<{ alt?: boolean }>`
  padding: 64px 24px;
  background: ${p => (p.alt ? ins.sectionAlt : ins.pageBg)};

  @media (min-width: 768px) {
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
  color: ${ins.text};

  @media (min-width: 768px) {
    font-size: 26px;
  }
`;

/* ── Point Cards ── */
export const PointGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
`;

export const PointCard = styled.div`
  padding: 28px 24px;
  border-radius: 12px;
  background: ${ins.cardBg};
  border: 1px solid ${ins.border};
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.05);
  transition: all 0.25s;

  &:hover {
    border-color: rgba(37, 99, 235, 0.3);
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.1);
    transform: translateY(-2px);
  }
`;

export const PointIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: ${ins.primaryPale};
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
  color: ${ins.text};
`;

export const PointDesc = styled.p`
  font-size: 13px;
  color: ${ins.sub};
  line-height: 1.6;
  margin: 0;
`;

/* ── Enrollment Form Section ── */
export const FormSection = styled.section`
  padding: 64px 24px;
  background: ${ins.sectionAlt};

  @media (min-width: 768px) {
    padding: 80px 48px;
  }
`;

export const FormCard = styled.div`
  max-width: 480px;
  margin: 0 auto;
  padding: 36px 32px;
  border-radius: 16px;
  background: ${ins.cardBg};
  border: 1px solid ${ins.border};
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.07);
`;

export const FormTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 28px;
  color: ${ins.text};
`;

export const SubmitBtn = styled.button<{ $loading?: boolean }>`
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: ${p => (p.$loading ? '#94A3B8' : ins.primary)};
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  cursor: ${p => (p.$loading ? 'not-allowed' : 'pointer')};
  transition: all 0.25s;
  margin-top: 8px;

  ${p => !p.$loading && `
    &:hover {
      background: ${ins.primaryDark};
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3);
    }
  `}

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
`;

export const PremiumDisplay = styled.div`
  width: 100%;
  padding: 10px 12px;
  background: ${ins.primaryPale};
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 8px;
  color: ${ins.primary};
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
  background: ${ins.successPale};
  min-height: 60vh;
`;

export const CompleteCard = styled.div`
  max-width: 460px;
  width: 100%;
  padding: 36px 32px;
  border-radius: 16px;
  background: ${ins.cardBg};
  border: 1px solid rgba(5, 150, 105, 0.2);
  box-shadow: 0 4px 24px rgba(5, 150, 105, 0.1);
  animation: ${fadeInUp} 0.5s ease-out;
`;

export const CompleteIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: ${ins.successPale};
  border: 2px solid rgba(5, 150, 105, 0.3);
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
  color: ${ins.success};
`;

export const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid ${ins.border};
  font-size: 13px;

  &:last-of-type {
    border-bottom: none;
  }
`;

export const SummaryLabel = styled.span`
  color: ${ins.sub};
`;

export const SummaryValue = styled.span`
  font-weight: 600;
  font-family: 'DM Mono', monospace;
  color: ${ins.text};
`;

export const CompleteMessage = styled.p`
  font-size: 13px;
  color: ${ins.sub};
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
  background: ${ins.primary};
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    background: ${ins.primaryDark};
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
    transform: translateY(-1px);
  }
`;

/* ── Footer ── */
export const Footer = styled.footer`
  padding: 24px 32px;
  text-align: center;
  border-top: 1px solid ${ins.border};
  font-size: 11px;
  color: ${ins.sub};
  background: ${ins.cardBg};
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: center;
    gap: 16px;
  }
`;

/* ── Light-themed Form components (overrides dark app theme) ── */
export const LightFormGroup = styled.div`
  margin-bottom: 14px;
`;

export const LightFormLabel = styled.label`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${ins.sub};
  margin-bottom: 5px;
  display: block;
`;

const lightInputBase = `
  width: 100%;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid ${ins.border};
  border-radius: 8px;
  color: ${ins.text};
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: ${ins.primary};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  &::placeholder {
    color: #CBD5E1;
  }
`;

export const LightFormInput = styled.input`${lightInputBase}`;

export const LightFormSelect = styled.select`
  ${lightInputBase}
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-color: #fff;
  padding-right: 32px;
  cursor: pointer;
`;

/* ── Loading shimmer for submit button ── */
export const ShimmerText = styled.span`
  background: linear-gradient(90deg, #fff 25%, rgba(255,255,255,0.5) 50%, #fff 75%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 1.5s infinite linear;
`;
