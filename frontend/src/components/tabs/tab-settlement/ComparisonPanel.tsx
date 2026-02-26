import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody, Divider, SummaryRow } from '@/components/common';
import { useTranslation } from 'react-i18next';

const ComparisonItem = styled.div<{ variant: 'bad' | 'good' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 10px;
  ${p => p.variant === 'bad' && `
    border: 1px solid rgba(239,68,68,.25);
    background: rgba(239,68,68,.04);
    color: var(--danger);
  `}
  ${p => p.variant === 'good' && `
    border: 1px solid rgba(20,241,149,.25);
    background: rgba(20,241,149,.04);
    color: var(--accent);
  `}
`;

export function ComparisonPanel() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader><CardTitle>{t('compare.title')}</CardTitle></CardHeader>
      <CardBody>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 6 }}>{t('compare.traditional')}</div>
        <ComparisonItem variant="bad">{t('compare.trad1')}</ComparisonItem>
        <ComparisonItem variant="bad">{t('compare.trad2')}</ComparisonItem>
        <ComparisonItem variant="bad">{t('compare.trad3')}</ComparisonItem>
        <ComparisonItem variant="bad" style={{ marginBottom: 10 }}>{t('compare.trad4')}</ComparisonItem>

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>OpenParametric</div>
        <ComparisonItem variant="good">{t('compare.op1')}</ComparisonItem>
        <ComparisonItem variant="good">{t('compare.op2')}</ComparisonItem>
        <ComparisonItem variant="good">{t('compare.op3')}</ComparisonItem>
        <ComparisonItem variant="good" style={{ marginBottom: 10 }}>{t('compare.op4')}</ComparisonItem>

        <Divider />
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('compare.timeSaved')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('compare.timeSavedValue')}</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('compare.errorRate')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--success)' }}>0%</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('compare.auditTrail')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('compare.auditValue')}</span>
        </SummaryRow>
      </CardBody>
    </Card>
  );
}
