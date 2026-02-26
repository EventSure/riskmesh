import { Card, CardHeader, CardTitle, CardBody, FormGroup, FormLabel, FormInput, SummaryRow } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

export function ShareStructure() {
  const { shares, setShares } = useProtocolStore();
  const { t } = useTranslation();
  const total = shares.leader + shares.partA + shares.partB;
  const valid = total === 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('share.title')}</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 7 }}>
          {t('share.structure')}
        </div>
        <FormGroup>
          <FormLabel>{t('share.leaderShare')}</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={shares.leader}
            onChange={e => setShares({ leader: parseInt(e.target.value) || 0 })}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('share.partAShare')}</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={shares.partA}
            onChange={e => setShares({ partA: parseInt(e.target.value) || 0 })}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('share.partBShare')}</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={shares.partB}
            onChange={e => setShares({ partB: parseInt(e.target.value) || 0 })}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <div style={{ fontSize: 10, color: valid ? 'var(--success)' : 'var(--danger)', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
          {t('common.total')}: {total}% {valid ? '✓' : '❌'}
        </div>
        <SummaryRow><span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('share.reinCommRate')}</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>10%</span></SummaryRow>
        <SummaryRow><span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('share.cessionRate')}</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('share.cessionValue')}</span></SummaryRow>
      </CardBody>
    </Card>
  );
}
