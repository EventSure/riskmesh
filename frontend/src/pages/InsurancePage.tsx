import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FormGroup, FormLabel, FormInput, FormSelect } from '@/components/common';
import { FLIGHTS, FLIGHT_ROUTES, useProtocolStore } from '@/store/useProtocolStore';
import { enrollPolicy, type EnrollmentResult } from '@/services/insurerApi';
import {
  PageWrap, Header, BrandWrap, BrandIcon, BrandName, BrandSub,
  HeroWrap, HeroContent, HeroTag, HeroTitle, HeroSubtitle, HeroCTA,
  Section, SectionInner, SectionTitle, PointGrid, PointCard, PointIcon, PointTitle, PointDesc,
  FormSection, FormCard, FormTitle, SubmitBtn, PremiumDisplay, ShimmerText,
  CompleteWrap, CompleteCard, CompleteIcon, CompleteTitle,
  SummaryRow, SummaryLabel, SummaryValue, CompleteMessage, ConfirmBtn,
  Footer,
} from '@/components/insurance/InsuranceStyles';

type PageState = 'landing' | 'complete';

interface CompletionData {
  contractId: string;
  name: string;
  flight: string;
  route: string;
  date: string;
  premium: number;
}

export function InsurancePage() {
  const { t, i18n } = useTranslation();
  const premiumPerPolicy = useProtocolStore(s => s.premiumPerPolicy);

  const [pageState, setPageState] = useState<PageState>('landing');
  const [name, setName] = useState('');
  const [flight, setFlight] = useState<string>(FLIGHTS[0]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const formRef = useRef<HTMLElement>(null);

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const toggleLang = useCallback(() => {
    i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko');
  }, [i18n]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !date) return;
    setLoading(true);
    try {
      const result: EnrollmentResult = await enrollPolicy({
        subscriberName: name.trim(),
        flightNo: flight,
        departureDate: date,
      });

      if (result.success) {
        setCompletion({
          contractId: result.contractId,
          name: name.trim(),
          flight,
          route: FLIGHT_ROUTES[flight] || '',
          date,
          premium: result.premium,
        });
        setPageState('complete');
      } else if (result.error === 'no_master_policy') {
        alert(t('insurance.error.inactive'));
      } else {
        alert(t('insurance.error.apiFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [name, flight, date]);

  const handleReset = useCallback(() => {
    setPageState('landing');
    setCompletion(null);
    setName('');
    setFlight(FLIGHTS[0]);
    setDate('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const isFormValid = name.trim().length > 0 && date.length > 0;

  /* ── Completion View ── */
  if (pageState === 'complete' && completion) {
    return (
      <PageWrap>
        <Header>
          <BrandWrap>
            <BrandIcon>✈</BrandIcon>
            <BrandName>{t('insurance.brand.name')}</BrandName>
          </BrandWrap>
        </Header>

        <CompleteWrap>
          <CompleteCard>
            <CompleteIcon>✓</CompleteIcon>
            <CompleteTitle>{t('insurance.complete.title')}</CompleteTitle>

            <SummaryRow>
              <SummaryLabel>{t('insurance.complete.contractNo')}</SummaryLabel>
              <SummaryValue>{completion.contractId}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>{t('insurance.complete.name')}</SummaryLabel>
              <SummaryValue>{completion.name}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>{t('insurance.complete.flight')}</SummaryLabel>
              <SummaryValue>{completion.flight} ({completion.route})</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>{t('insurance.complete.date')}</SummaryLabel>
              <SummaryValue>{completion.date}</SummaryValue>
            </SummaryRow>
            <SummaryRow>
              <SummaryLabel>{t('insurance.complete.premium')}</SummaryLabel>
              <SummaryValue>{completion.premium} USDC</SummaryValue>
            </SummaryRow>

            <CompleteMessage>{t('insurance.complete.message')}</CompleteMessage>

            <ConfirmBtn onClick={handleReset}>
              {t('insurance.complete.confirm')}
            </ConfirmBtn>
          </CompleteCard>
        </CompleteWrap>

        <Footer>
          <span>{t('insurance.footer.copyright')}</span>
          <span>{t('insurance.footer.powered')}</span>
        </Footer>
      </PageWrap>
    );
  }

  /* ── Landing View ── */
  return (
    <PageWrap>
      {/* Header */}
      <Header>
        <BrandWrap>
          <BrandIcon>✈</BrandIcon>
          <BrandName>{t('insurance.brand.name')}</BrandName>
          <BrandSub>{t('insurance.brand.sub')}</BrandSub>
        </BrandWrap>
        <button
          onClick={toggleLang}
          style={{
            background: 'transparent',
            border: '1px solid rgba(148,163,184,0.3)',
            borderRadius: 6,
            color: '#94A3B8',
            padding: '5px 12px',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {i18n.language === 'ko' ? 'EN' : 'KO'}
        </button>
      </Header>

      {/* Hero */}
      <HeroWrap>
        <HeroContent>
          <HeroTag>{t('insurance.hero.tag')}</HeroTag>
          <HeroTitle>{t('insurance.hero.title')}</HeroTitle>
          <HeroSubtitle>{t('insurance.hero.subtitle')}</HeroSubtitle>
          <HeroCTA onClick={scrollToForm}>{t('insurance.hero.cta')}</HeroCTA>
        </HeroContent>
      </HeroWrap>

      {/* Product Points */}
      <Section>
        <SectionInner>
          <SectionTitle>{t('insurance.points.sectionTitle')}</SectionTitle>
          <PointGrid>
            <PointCard>
              <PointIcon>⏱</PointIcon>
              <PointTitle>{t('insurance.points.auto.title')}</PointTitle>
              <PointDesc>{t('insurance.points.auto.desc')}</PointDesc>
            </PointCard>
            <PointCard>
              <PointIcon>📋</PointIcon>
              <PointTitle>{t('insurance.points.simple.title')}</PointTitle>
              <PointDesc>{t('insurance.points.simple.desc')}</PointDesc>
            </PointCard>
            <PointCard>
              <PointIcon>⛓</PointIcon>
              <PointTitle>{t('insurance.points.onchain.title')}</PointTitle>
              <PointDesc>{t('insurance.points.onchain.desc')}</PointDesc>
            </PointCard>
          </PointGrid>
        </SectionInner>
      </Section>

      {/* Enrollment Form */}
      <FormSection ref={formRef}>
        <FormCard>
          <FormTitle>{t('insurance.form.title')}</FormTitle>

          <FormGroup>
            <FormLabel>{t('insurance.form.name')}</FormLabel>
            <FormInput
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('insurance.form.namePlaceholder')}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>{t('insurance.form.flight')}</FormLabel>
            <FormSelect
              value={flight}
              onChange={e => setFlight(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              {FLIGHTS.map(f => (
                <option key={f} value={f}>
                  {f} ({FLIGHT_ROUTES[f]})
                </option>
              ))}
            </FormSelect>
          </FormGroup>

          <FormGroup>
            <FormLabel>{t('insurance.form.date')}</FormLabel>
            <FormInput
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>{t('insurance.form.premium')}</FormLabel>
            <PremiumDisplay>{premiumPerPolicy} USDC</PremiumDisplay>
          </FormGroup>

          <SubmitBtn
            $loading={loading}
            disabled={!isFormValid || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <ShimmerText>{t('insurance.form.submitting')}</ShimmerText>
            ) : (
              t('insurance.form.submit')
            )}
          </SubmitBtn>
        </FormCard>
      </FormSection>

      {/* Footer */}
      <Footer>
        <span>{t('insurance.footer.copyright')}</span>
        <span>{t('insurance.footer.powered')}</span>
      </Footer>
    </PageWrap>
  );
}
