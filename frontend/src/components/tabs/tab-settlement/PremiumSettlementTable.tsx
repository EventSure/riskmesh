import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';
import { useSettlementData } from '@/hooks/useSettlementData';

export function PremiumSettlementTable() {
  const { t } = useTranslation();
  const { leaderShare, participants, reinsurer, cededRatioBps, reinsCommissionBps } = useProtocolStore();
  const { settledTotalPremium } = useSettlementData();
  const ceded = cededRatioBps / 10000;
  const retained = 1 - ceded;
  const commRate = reinsCommissionBps / 10000;
  const reinsEff = reinsurer.enabled ? ceded : 0;

  const rows = [
    { label: t('settle.party.leader'), s: leaderShare / 100 },
    ...participants.map((p, i) => ({ label: p.name || `${t('settle.party.participant')} ${i + 1}`, s: p.share / 100 })),
  ].map(r => {
    const raw = settledTotalPremium * r.s;
    const toR = raw * reinsEff;
    const comm = toR * commRate;
    const net = raw - toR + comm;
    return { ...r, raw, toR, comm, net };
  });

  const rIn = settledTotalPremium * reinsEff;
  const rOut = rIn * commRate;

  return (
    <Card>
      <CardHeader><CardTitle>{t('settle.premTitle')}</CardTitle></CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        <SettlementTable>
          <thead>
            <tr><th>{t('settle.premTh.party')}</th><th>{t('settle.premTh.share')}</th><th>{t('settle.premTh.primary')}</th><th>{t('settle.premTh.ceded')}</th><th>{t('settle.premTh.commission')}</th><th>{t('settle.premTh.net')}</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{formatNum(r.s * retained * 100, 0)}%</td>
                <td>{formatNum(r.raw, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(r.toR, 4)}</td>
                <td style={{ color: 'var(--accent)' }}>{formatNum(r.comm, 4)}</td>
                <td style={{ color: 'var(--success)' }}>{formatNum(r.net, 4)}</td>
              </tr>
            ))}
            {reinsurer.enabled && (
              <tr className="trein">
                <td>{t('settle.party.reinsurer')}</td>
                <td>{formatNum(ceded * 100, 0)}%</td>
                <td>—</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(rIn, 4)}</td>
                <td style={{ color: 'var(--warning)' }}>-{formatNum(rOut, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(rIn - rOut, 4)}</td>
              </tr>
            )}
            <tr className="ttr">
              <td>{t('settle.party.total')}</td>
              <td>—</td>
              <td>{formatNum(settledTotalPremium, 4)}</td>
              <td>—</td>
              <td>—</td>
              <td>{formatNum(settledTotalPremium, 4)}</td>
            </tr>
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
