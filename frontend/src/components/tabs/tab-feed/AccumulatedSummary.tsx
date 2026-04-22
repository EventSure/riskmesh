import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore, formatNum, PARTICIPANT_COLORS } from '@/store/useProtocolStore';

export function AccumulatedSummary() {
  const { t } = useTranslation();
  const { contracts, totalPremium, acc, participants, reinsurerEnabled } = useProtocolStore(
    useShallow(s => ({
      contracts: s.contracts,
      totalPremium: s.totalPremium,
      acc: s.acc,
      participants: s.participants,
      reinsurerEnabled: s.reinsurer.enabled,
    })),
  );

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
        {participants.map((p, i) => (
          <SummaryRow key={p.id}>
            <span style={{ fontSize: 10, color: 'var(--sub)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: PARTICIPANT_COLORS[i], display: 'inline-block' }} />
              {p.name || `${t('feed.participant')} ${i + 1}`}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(acc.participantPrems[i] ?? 0, 4)} USDC</span>
          </SummaryRow>
        ))}
        {reinsurerEnabled && (
          <SummaryRow>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('feed.reinNet')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(acc.reinPrem, 4)} USDC</span>
          </SummaryRow>
        )}
      </CardBody>
    </Card>
  );
}
