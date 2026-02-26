import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';

export function AccumulatedSummary() {
  const { t } = useTranslation();
  const { contracts, totalPremium, acc } = useProtocolStore();

  return (
    <Card>
      <CardHeader><CardTitle>{t('feed.summaryTitle')}</CardTitle></CardHeader>
      <CardBody>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.totalContracts')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: contracts.length })}</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.totalPremium')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(totalPremium, 2)} USDC</span>
        </SummaryRow>
        <Divider />
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 5, fontWeight: 700 }}>{t('feed.premSettlement')}</div>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.leaderNet')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(acc.leaderPrem, 4)} USDC</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.partANet')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(acc.partAPrem, 4)} USDC</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.partBNet')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(acc.partBPrem, 4)} USDC</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.reinNet')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(acc.reinPrem, 4)} USDC</span>
        </SummaryRow>
      </CardBody>
    </Card>
  );
}
