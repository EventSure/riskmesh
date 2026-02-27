import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

export function PremiumSettlementTable() {
  const { t } = useTranslation();
  const { totalPremium, shares, cededRatioBps, reinsCommissionBps } = useProtocolStore();
  const lS = shares.leader / 100, aS = shares.partA / 100, bS = shares.partB / 100;
  const ceded = cededRatioBps / 10000;
  const commRate = reinsCommissionBps / 10000;
  const reinsEff = ceded * (1 - commRate);

  const rows = [
    { label: t('settle.party.leader'), s: lS },
    { label: t('settle.party.partA'), s: aS },
    { label: t('settle.party.partB'), s: bS },
  ].map(r => {
    const raw = totalPremium * r.s;
    const toR = raw * ceded;
    const comm = toR * commRate;
    const net = raw - toR + comm;
    return { ...r, raw, toR, comm, net };
  });

  const rIn = totalPremium * ceded;
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
                <td>{formatNum(r.s * 100, 0)}%</td>
                <td>{formatNum(r.raw, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(r.toR, 4)}</td>
                <td style={{ color: 'var(--accent)' }}>{formatNum(r.comm, 4)}</td>
                <td style={{ color: 'var(--success)' }}>{formatNum(r.net, 4)}</td>
              </tr>
            ))}
            <tr className="trein">
              <td>{t('settle.party.reinsurer')}</td>
              <td>{formatNum(reinsEff * 100, 0)}%</td>
              <td>—</td>
              <td style={{ color: 'var(--info)' }}>{formatNum(rIn, 4)}</td>
              <td style={{ color: 'var(--warning)' }}>-{formatNum(rOut, 4)}</td>
              <td style={{ color: 'var(--info)' }}>{formatNum(rIn - rOut, 4)}</td>
            </tr>
            <tr className="ttr">
              <td>{t('settle.party.total')}</td>
              <td>—</td>
              <td>{formatNum(totalPremium, 4)}</td>
              <td>—</td>
              <td>—</td>
              <td>{formatNum(totalPremium, 4)}</td>
            </tr>
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
