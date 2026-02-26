import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';

export function MasterContractSetup() {
  const { masterActive, processStep, setTerms } = useProtocolStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSetTerms = () => {
    const result = setTerms();
    if (!result.ok) { toast(result.msg!, 'd'); return; }
    toast(t('toast.termsSet'), 'i');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('master.title')}</CardTitle>
        <Tag variant={masterActive ? 'accent' : 'subtle'}>{masterActive ? t('common.active') : t('common.inactive')}</Tag>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>{t('master.coverageStart')}</FormLabel>
          <FormInput defaultValue="2026-01-01" />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.coverageEnd')}</FormLabel>
          <FormInput defaultValue="2026-12-31" />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.coverageType')}</FormLabel>
          <FormInput value={t('master.coverageTypeValue')} readOnly style={{ opacity: 0.6 }} />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('master.premiumPerContract')}</FormLabel>
          <FormInput type="number" defaultValue={1} min={1} style={{ fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        <Divider />
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 6 }}>
          {t('master.payoutByTier')}
        </div>
        <TierItem label="2h~2h59m" value="40 USDC" color="#F59E0B" />
        <TierItem label="3h~3h59m" value="60 USDC" color="#f97316" />
        <TierItem label="4h~5h59m" value="80 USDC" color="#EF4444" />
        <TierItem label={t('master.tier.6h')} value="100 USDC" color="#fca5a5" />
        <Divider />
        <Button variant="primary" fullWidth onClick={handleSetTerms} disabled={processStep >= 1}>
          {t('master.setTermsBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
