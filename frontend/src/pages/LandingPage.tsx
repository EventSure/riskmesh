import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ══════════════════════════════════════════════
   Keyframes
   ══════════════════════════════════════════════ */

const float = keyframes`
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.02); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

/* ══════════════════════════════════════════════
   Layout
   ══════════════════════════════════════════════ */

const Page = styled.div`
  min-height: 100vh;
  background: ${p => p.theme.colors.bg};
  overflow-x: hidden;
`;

const Nav = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 40px;
  background: rgba(11, 17, 32, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid ${p => p.theme.colors.border};

  @media (max-width: 768px) {
    padding: 12px 20px;
  }
`;

const NavLogo = styled.div`
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
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 0 20px ${p => p.theme.glow.primary};
`;

const LogoText = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
`;

const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LangSelect = styled.select`
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
  background-position: right 8px center;
`;

const NavCta = styled.button`
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  font-family: ${p => p.theme.fonts.sans};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: ${p => p.theme.colors.accent};
  color: ${p => p.theme.colors.bg};
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 0 24px ${p => p.theme.glow.accent};
    transform: translateY(-1px);
  }
`;

const Section = styled.section`
  padding: 120px 40px 80px;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 80px 20px 60px;
  }
`;

const SectionTag = styled.span`
  display: inline-block;
  font-family: ${p => p.theme.fonts.mono};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${p => p.theme.colors.accent};
  margin-bottom: 16px;
`;

const SectionTitle = styled.h2`
  font-size: 36px;
  font-weight: 800;
  line-height: 1.2;
  color: ${p => p.theme.colors.text};
  margin-bottom: 20px;

  @media (max-width: 768px) {
    font-size: 28px;
  }
`;

const SectionSub = styled.p`
  font-size: 16px;
  line-height: 1.7;
  color: ${p => p.theme.colors.sub};
  max-width: 640px;
`;

/* ══════════════════════════════════════════════
   Hero
   ══════════════════════════════════════════════ */

const HeroWrap = styled.section`
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 40px;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 0 20px;
  }
`;

const HeroOrb = styled.div`
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(153,69,255,0.15) 0%, rgba(20,241,149,0.08) 50%, transparent 70%);
  filter: blur(80px);
  animation: ${float} 8s ease-in-out infinite;
  pointer-events: none;

  @media (max-width: 768px) {
    width: 350px;
    height: 350px;
  }
`;

const HeroOrbSecondary = styled.div`
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(20,241,149,0.12) 0%, rgba(56,189,248,0.05) 50%, transparent 70%);
  filter: blur(60px);
  top: 20%;
  right: 15%;
  animation: ${pulse} 6s ease-in-out infinite;
  pointer-events: none;

  @media (max-width: 768px) {
    width: 250px;
    height: 250px;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 800px;
`;

const HeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid ${p => p.theme.colors.border2};
  background: rgba(153,69,255,0.08);
  font-family: ${p => p.theme.fonts.mono};
  font-size: 12px;
  font-weight: 600;
  color: ${p => p.theme.colors.primary};
  margin-bottom: 28px;
`;

const BadgeDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.theme.colors.accent};
  box-shadow: 0 0 6px ${p => p.theme.colors.accent};
`;

const HeroTitle = styled.h1`
  font-size: 56px;
  font-weight: 800;
  line-height: 1.1;
  color: ${p => p.theme.colors.text};
  margin-bottom: 24px;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const GradientText = styled.span`
  background: linear-gradient(135deg, ${p => p.theme.colors.primary}, ${p => p.theme.colors.accent});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const HeroSub = styled.p`
  font-size: 18px;
  line-height: 1.6;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 40px;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;

  @media (max-width: 768px) {
    font-size: 15px;
  }
`;

const HeroCta = styled.button`
  padding: 14px 36px;
  border-radius: 12px;
  border: none;
  font-family: ${p => p.theme.fonts.sans};
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  background: ${p => p.theme.colors.accent};
  color: ${p => p.theme.colors.bg};
  box-shadow: 0 0 30px ${p => p.theme.glow.accent};
  transition: all 0.25s;

  &:hover {
    box-shadow: 0 0 50px rgba(20,241,149,0.45);
    transform: translateY(-2px);
  }
`;

const HeroCtaOutline = styled.a`
  padding: 14px 36px;
  border-radius: 12px;
  border: 1px solid ${p => p.theme.colors.border2};
  font-family: ${p => p.theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: ${p => p.theme.colors.text};
  transition: all 0.25s;
  text-decoration: none;

  &:hover {
    border-color: ${p => p.theme.colors.primary};
    color: ${p => p.theme.colors.primary};
  }
`;

const HeroActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

/* ══════════════════════════════════════════════
   Cards Grid
   ══════════════════════════════════════════════ */

const CardGrid = styled.div<{ cols?: number }>`
  display: grid;
  grid-template-columns: repeat(${p => p.cols ?? 3}, 1fr);
  gap: 20px;
  margin-top: 40px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 12px;
  padding: 28px 24px;
  transition: all 0.3s;

  &:hover {
    border-color: ${p => p.theme.colors.border2};
    box-shadow: 0 0 30px rgba(153,69,255,0.08);
    transform: translateY(-2px);
  }
`;

const CardIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 16px;
  background: rgba(153,69,255,0.1);
  border: 1px solid rgba(153,69,255,0.2);
`;

const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
  margin-bottom: 8px;
`;

const CardDesc = styled.p`
  font-size: 13px;
  line-height: 1.6;
  color: ${p => p.theme.colors.sub};
`;

/* ══════════════════════════════════════════════
   Solution Cards (glow variant)
   ══════════════════════════════════════════════ */

const GlowCard = styled(Card)<{ glowColor?: string }>`
  border-color: transparent;
  background: linear-gradient(${p => p.theme.colors.card}, ${p => p.theme.colors.card}) padding-box,
              linear-gradient(135deg,
                ${p => p.glowColor || 'rgba(153,69,255,0.3)'},
                transparent 60%
              ) border-box;
  border: 1px solid transparent;
`;

/* ══════════════════════════════════════════════
   How It Works — Steps
   ══════════════════════════════════════════════ */

const StepsWrap = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0;
  margin-top: 48px;
  position: relative;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Step = styled.div`
  position: relative;
  padding: 24px;
  text-align: center;
`;

const StepNumber = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${p => p.theme.colors.primary}, ${p => p.theme.colors.accent});
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${p => p.theme.fonts.mono};
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  margin: 0 auto 14px;
  box-shadow: 0 0 20px ${p => p.theme.glow.primary};
`;

const StepTitle = styled.h4`
  font-size: 14px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
  margin-bottom: 6px;
`;

const StepDesc = styled.p`
  font-size: 12px;
  line-height: 1.5;
  color: ${p => p.theme.colors.sub};
`;

const StepsConnector = styled.div`
  position: absolute;
  top: 44px;
  left: 8%;
  right: 8%;
  height: 2px;
  background: linear-gradient(90deg,
    ${p => p.theme.colors.primary},
    ${p => p.theme.colors.accent}
  );
  opacity: 0.3;
  z-index: 0;

  @media (max-width: 768px) {
    display: none;
  }
`;

/* ══════════════════════════════════════════════
   Why Solana — Feature Row
   ══════════════════════════════════════════════ */

const SolanaSection = styled(Section)`
  text-align: center;
`;

const FeatureRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-top: 48px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const FeatureItem = styled.div`
  padding: 32px 20px;
  border-radius: 12px;
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
`;

const FeatureIcon = styled.div`
  font-size: 28px;
  margin-bottom: 12px;
`;

const FeatureLabel = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
  margin-bottom: 4px;
`;

const FeatureDetail = styled.div`
  font-size: 12px;
  color: ${p => p.theme.colors.sub};
`;

/* ══════════════════════════════════════════════
   Market Stats
   ══════════════════════════════════════════════ */

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-top: 48px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  padding: 36px 28px;
  border-radius: 16px;
  background: ${p => p.theme.colors.card};
  border: 1px solid ${p => p.theme.colors.border};
  text-align: center;
`;

const StatValue = styled.div`
  font-family: ${p => p.theme.fonts.mono};
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 8px;
  background: linear-gradient(135deg, ${p => p.theme.colors.primary}, ${p => p.theme.colors.accent});
  background-size: 200% auto;
  animation: ${shimmer} 3s linear infinite;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const StatLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${p => p.theme.colors.text};
  margin-bottom: 4px;
`;

const StatSub = styled.div`
  font-size: 12px;
  color: ${p => p.theme.colors.sub};
`;

/* ══════════════════════════════════════════════
   Vision / CTA Footer
   ══════════════════════════════════════════════ */

const VisionSection = styled.section`
  padding: 100px 40px;
  text-align: center;
  position: relative;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 80px 20px;
  }
`;

const VisionBg = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(153,69,255,0.08) 0%, transparent 70%);
  pointer-events: none;
`;

const VisionContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 700px;
  margin: 0 auto;
`;

const VisionTitle = styled.h2`
  font-size: 40px;
  font-weight: 800;
  line-height: 1.2;
  color: ${p => p.theme.colors.text};
  margin-bottom: 20px;

  @media (max-width: 768px) {
    font-size: 28px;
  }
`;

const VisionSub = styled.p`
  font-size: 16px;
  line-height: 1.7;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 40px;
`;

const Footer = styled.footer`
  padding: 32px 40px;
  border-top: 1px solid ${p => p.theme.colors.border};
  text-align: center;
  font-size: 12px;
  color: ${p => p.theme.colors.sub};

  @media (max-width: 768px) {
    padding: 24px 20px;
  }
`;

/* ══════════════════════════════════════════════
   Divider
   ══════════════════════════════════════════════ */

const Divider = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, ${p => p.theme.colors.border2}, transparent);
`;

/* ══════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════ */

export function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const goDemo = () => navigate('/demo');

  return (
    <Page>
      {/* ── Navbar ── */}
      <Nav>
        <NavLogo>
          <LogoMark>OP</LogoMark>
          <LogoText>Open Parametric</LogoText>
        </NavLogo>
        <NavRight>
          <LangSelect
            value={i18n.language}
            onChange={e => i18n.changeLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </LangSelect>
          <NavCta onClick={goDemo}>{t('landing.cta')}</NavCta>
        </NavRight>
      </Nav>

      {/* ── Hero ── */}
      <HeroWrap>
        <HeroOrb />
        <HeroOrbSecondary />
        <HeroContent>
          <HeroBadge>
            <BadgeDot />
            {t('landing.badge')}
          </HeroBadge>
          <HeroTitle>
            {t('landing.heroTitle1')}{' '}
            <GradientText>{t('landing.heroTitle2')}</GradientText>
          </HeroTitle>
          <HeroSub>
            {t('landing.heroSub1')}<br />
            {t('landing.heroSub2')}
          </HeroSub>
          <HeroActions>
            <HeroCta onClick={goDemo}>{t('landing.cta')}</HeroCta>
            <HeroCtaOutline href="https://github.com/EventSure/riskmesh" target="_blank" rel="noopener noreferrer">
              GitHub
            </HeroCtaOutline>
          </HeroActions>
        </HeroContent>
      </HeroWrap>

      <Divider />

      {/* ── Problem ── */}
      <Section>
        <SectionTag>{t('landing.problemTag')}</SectionTag>
        <SectionTitle>{t('landing.problemTitle')}</SectionTitle>
        <SectionSub>{t('landing.problemSub')}</SectionSub>
        <CardGrid cols={3}>
          <Card>
            <CardIcon>👁</CardIcon>
            <CardTitle>{t('landing.problem1Title')}</CardTitle>
            <CardDesc>{t('landing.problem1Desc')}</CardDesc>
          </Card>
          <Card>
            <CardIcon>🔒</CardIcon>
            <CardTitle>{t('landing.problem2Title')}</CardTitle>
            <CardDesc>{t('landing.problem2Desc')}</CardDesc>
          </Card>
          <Card>
            <CardIcon>📊</CardIcon>
            <CardTitle>{t('landing.problem3Title')}</CardTitle>
            <CardDesc>{t('landing.problem3Desc')}</CardDesc>
          </Card>
        </CardGrid>
      </Section>

      <Divider />

      {/* ── Solution ── */}
      <Section>
        <SectionTag>{t('landing.solutionTag')}</SectionTag>
        <SectionTitle>{t('landing.solutionTitle')}</SectionTitle>
        <SectionSub>{t('landing.solutionSub')}</SectionSub>
        <CardGrid cols={4}>
          <GlowCard glowColor="rgba(153,69,255,0.3)">
            <CardIcon>⚡</CardIcon>
            <CardTitle>{t('landing.solution1Title')}</CardTitle>
            <CardDesc>{t('landing.solution1Desc')}</CardDesc>
          </GlowCard>
          <GlowCard glowColor="rgba(20,241,149,0.3)">
            <CardIcon>📝</CardIcon>
            <CardTitle>{t('landing.solution2Title')}</CardTitle>
            <CardDesc>{t('landing.solution2Desc')}</CardDesc>
          </GlowCard>
          <GlowCard glowColor="rgba(56,189,248,0.3)">
            <CardIcon>🔮</CardIcon>
            <CardTitle>{t('landing.solution3Title')}</CardTitle>
            <CardDesc>{t('landing.solution3Desc')}</CardDesc>
          </GlowCard>
          <GlowCard glowColor="rgba(245,158,11,0.3)">
            <CardIcon>🎯</CardIcon>
            <CardTitle>{t('landing.solution4Title')}</CardTitle>
            <CardDesc>{t('landing.solution4Desc')}</CardDesc>
          </GlowCard>
        </CardGrid>
      </Section>

      <Divider />

      {/* ── How It Works ── */}
      <Section>
        <SectionTag>{t('landing.howTag')}</SectionTag>
        <SectionTitle>{t('landing.howTitle')}</SectionTitle>
        <SectionSub>{t('landing.howSub')}</SectionSub>

        <StepsWrap>
          <StepsConnector />
          {[1, 2, 3, 4, 5, 6].map(n => (
            <Step key={n}>
              <StepNumber>{n}</StepNumber>
              <StepTitle>{t(`landing.step${n}Title`)}</StepTitle>
              <StepDesc>{t(`landing.step${n}Desc`)}</StepDesc>
            </Step>
          ))}
        </StepsWrap>
      </Section>

      <Divider />

      {/* ── Why Solana ── */}
      <SolanaSection>
        <SectionTag>{t('landing.solanaTag')}</SectionTag>
        <SectionTitle style={{ textAlign: 'center' }}>{t('landing.solanaTitle')}</SectionTitle>
        <SectionSub style={{ textAlign: 'center', margin: '0 auto' }}>
          {t('landing.solanaSub')}
        </SectionSub>
        <FeatureRow>
          <FeatureItem>
            <FeatureIcon>🚀</FeatureIcon>
            <FeatureLabel>{t('landing.solana1Label')}</FeatureLabel>
            <FeatureDetail>{t('landing.solana1Detail')}</FeatureDetail>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>💸</FeatureIcon>
            <FeatureLabel>{t('landing.solana2Label')}</FeatureLabel>
            <FeatureDetail>{t('landing.solana2Detail')}</FeatureDetail>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>⚡</FeatureIcon>
            <FeatureLabel>{t('landing.solana3Label')}</FeatureLabel>
            <FeatureDetail>{t('landing.solana3Detail')}</FeatureDetail>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>🛡</FeatureIcon>
            <FeatureLabel>{t('landing.solana4Label')}</FeatureLabel>
            <FeatureDetail>{t('landing.solana4Detail')}</FeatureDetail>
          </FeatureItem>
        </FeatureRow>
      </SolanaSection>

      <Divider />

      {/* ── Market ── */}
      <Section>
        <SectionTag>{t('landing.marketTag')}</SectionTag>
        <SectionTitle>{t('landing.marketTitle')}</SectionTitle>
        <SectionSub>{t('landing.marketSub')}</SectionSub>
        <StatGrid>
          <StatCard>
            <StatValue>$40.6B</StatValue>
            <StatLabel>{t('landing.market1Label')}</StatLabel>
            <StatSub>{t('landing.market1Sub')}</StatSub>
          </StatCard>
          <StatCard>
            <StatValue>$10.8B</StatValue>
            <StatLabel>{t('landing.market2Label')}</StatLabel>
            <StatSub>{t('landing.market2Sub')}</StatSub>
          </StatCard>
          <StatCard>
            <StatValue>$130B+</StatValue>
            <StatLabel>{t('landing.market3Label')}</StatLabel>
            <StatSub>{t('landing.market3Sub')}</StatSub>
          </StatCard>
        </StatGrid>
      </Section>

      <Divider />

      {/* ── Vision / CTA ── */}
      <VisionSection>
        <VisionBg />
        <VisionContent>
          <SectionTag>{t('landing.visionTag')}</SectionTag>
          <VisionTitle>{t('landing.visionTitle')}</VisionTitle>
          <VisionSub>{t('landing.visionSub')}</VisionSub>
          <HeroCta onClick={goDemo}>{t('landing.visionCta')}</HeroCta>
        </VisionContent>
      </VisionSection>

      {/* ── Footer ── */}
      <Footer>
        Open Parametric · Built on Solana · {new Date().getFullYear()}
      </Footer>
    </Page>
  );
}
